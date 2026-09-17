import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Wrench,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  PackageCheck,
  ShieldAlert,
  Users,
  Calendar,
  MapPin,
  Wifi,
  Tv2,
  Camera,
  Router,
  HardDrive,
  Truck,
  Sparkles,
  Layers,
  Cpu,
  Disc,
  Boxes,
  Check,
  Filter,
  LayoutGrid,
  List
} from 'lucide-react';
import {
  InstallationTicket,
  InstallationTicketType,
  WorkOrderDetail,
  WorkOrderRetrievalItem,
  WorkOrderListResponse,
  DispatchBoardResponse,
  DispatchGroup,
  WorkOrderLiquidatePayload
} from '../types';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tipos Estrictos de la Mesa (4 Categorías Gerenciales)
// ─────────────────────────────────────────────────────────────────────────────

export const STRICT_WORK_ORDER_TYPES: {
  value: string;
  typeKey: InstallationTicketType;
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
}[] = [
  {
    value: 'INSTALACION_NUEVA',
    typeKey: 'INSTALACION_NUEVA',
    label: 'Instalación',
    icon: <ArrowUpCircle className="w-3.5 h-3.5" />,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    badgeBg: 'bg-emerald-600'
  },
  {
    value: 'MANTENIMIENTO_RMA',
    typeKey: 'MANTENIMIENTO_RMA',
    label: 'Visita técnica',
    icon: <Wrench className="w-3.5 h-3.5" />,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    badgeBg: 'bg-amber-600'
  },
  {
    value: 'CAMBIO_EQUIPO',
    typeKey: 'CAMBIO_EQUIPO',
    label: 'Factibilidad',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-300',
    badgeBg: 'bg-sky-600'
  },
  {
    value: 'BAJA_SERVICIO',
    typeKey: 'BAJA_SERVICIO',
    label: 'Baja de servicio',
    icon: <ArrowDownCircle className="w-3.5 h-3.5" />,
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
    badgeBg: 'bg-rose-600'
  }
];

function getStrictTypeConfig(type: string) {
  const found = STRICT_WORK_ORDER_TYPES.find(t => t.value === type || t.typeKey === type);
  if (found) return found;

  // Fallbacks
  if (type.includes('INSTAL') || type.includes('ALTA')) return STRICT_WORK_ORDER_TYPES[0];
  if (type.includes('MANT') || type.includes('VISITA') || type.includes('RMA')) return STRICT_WORK_ORDER_TYPES[1];
  if (type.includes('FACT') || type.includes('CAMBIO')) return STRICT_WORK_ORDER_TYPES[2];
  if (type.includes('BAJA') || type.includes('CANC')) return STRICT_WORK_ORDER_TYPES[3];

  return {
    value: type,
    typeKey: 'MANTENIMIENTO_RMA' as InstallationTicketType,
    label: type.replace(/_/g, ' '),
    icon: <ClipboardList className="w-3.5 h-3.5" />,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    badgeBg: 'bg-slate-600'
  };
}

function TypeBadge({ type }: { type: string }) {
  const cfg = getStrictTypeConfig(type);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border} shrink-0`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function CategoryIcon({ category }: { category?: string }) {
  const cls = 'w-4 h-4 shrink-0';
  switch (category) {
    case 'ONU_ONT':
      return <Wifi className={`${cls} text-sky-600`} />;
    case 'TV_BOX_OTT':
      return <Tv2 className={`${cls} text-violet-600`} />;
    case 'CAMARA_SEGURIDAD_IOT':
      return <Camera className={`${cls} text-rose-500`} />;
    case 'ROUTER_WIFI':
    case 'REPETIDOR_MESH':
      return <Router className={`${cls} text-amber-600`} />;
    default:
      return <HardDrive className={`${cls} text-slate-500`} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Modal de Detalle y Liquidación Transaccional ("Efecto Wow")
// ─────────────────────────────────────────────────────────────────────────────

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onCompleted: () => void;
}

function OrderDetailModal({ orderId, onClose, onCompleted }: OrderDetailModalProps) {
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<string[]>([]);

  // Baja de servicio state
  const [defectiveIds, setDefectiveIds] = useState<Set<string>>(new Set());

  // Liquidación de materiales state
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [metersUsed, setMetersUsed] = useState<number>(85);
  const [connectorsUsed, setConnectorsUsed] = useState<number>(2);
  const [tensorsUsed, setTensorsUsed] = useState<number>(2);
  const [serialSearch, setSerialSearch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getWorkOrderDetail(orderId);
        setDetail(data);

        // Pre-seleccionar primera bobina si existe
        if (data.vehicleInventory?.batches && data.vehicleInventory.batches.length > 0) {
          setSelectedBatchId(data.vehicleInventory.batches[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Error al cargar detalle de la orden');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const toggleDefective = (id: string) => {
    setDefectiveIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const ticket = detail?.ticket;
  const isBaja = ticket?.type === 'BAJA_SERVICIO';
  const vehicleInventory = detail?.vehicleInventory;
  const availableSerials = vehicleInventory?.serials || [];
  const availableBatches = vehicleInventory?.batches || [];

  // Filtrado de seriales cargados específicamente en el móvil
  const filteredSerials = availableSerials.filter(item => {
    const q = serialSearch.trim().toUpperCase();
    if (!q) return true;
    return (
      (item.serialNumber && item.serialNumber.toUpperCase().includes(q)) ||
      (item.macAddress && item.macAddress.toUpperCase().includes(q)) ||
      (item.product?.name && item.product.name.toUpperCase().includes(q)) ||
      (item.product?.model && item.product.model.toUpperCase().includes(q))
    );
  });

  const selectedBatch = availableBatches.find(b => b.id === selectedBatchId) || availableBatches[0];
  const projectedRemainingMeters = selectedBatch ? Math.max(0, selectedBatch.currentQuantity - metersUsed) : 0;

  // Manejo de Cierre / Liquidación
  const handleExecute = async () => {
    if (!ticket) return;
    try {
      setProcessing(true);
      setError(null);

      if (isBaja) {
        const result = await api.completeWorkOrder(ticket.id, {
          defectiveItemIds: Array.from(defectiveIds),
          notes
        });
        setSuccessMessage(result.message || 'Baja de servicio completada exitosamente.');
      } else {
        // Flujo de Liquidación Atómica de Materiales
        const payload: WorkOrderLiquidatePayload = {
          serialNumber: selectedSerial || undefined,
          batchUsage: selectedBatch ? {
            batchId: selectedBatch.id,
            batchNumber: selectedBatch.batchNumber,
            metersUsed: Number(metersUsed) || 0
          } : undefined,
          bulkUsage: [
            ...(connectorsUsed > 0 && vehicleInventory?.bulks?.[0] ? [{
              productId: vehicleInventory.bulks[0].productId || vehicleInventory.bulks[0].id,
              quantity: connectorsUsed
            }] : []),
            ...(tensorsUsed > 0 && vehicleInventory?.bulks?.[1] ? [{
              productId: vehicleInventory.bulks[1].productId || vehicleInventory.bulks[1].id,
              quantity: tensorsUsed
            }] : [])
          ],
          notes: notes || `Liquidado en campo con S/N: ${selectedSerial || 'N/A'}, ${metersUsed}m drop, ${connectorsUsed} conectores.`
        };

        const result = await api.liquidateWorkOrder(ticket.id, payload);
        setSuccessMessage(result.message || 'Liquidación procesada y sincronizada con Wispro.');
        if (result.auditEntries) {
          setAuditEntries(result.auditEntries);
        }
      }

      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la liquidación');
    } finally {
      setProcessing(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {loading ? 'Cargando orden...' : `Orden ${ticket?.ticketNumber}`}
                </h2>
                {ticket && <TypeBadge type={ticket.type} />}
              </div>
              {ticket && (
                <p className="text-xs text-slate-300">
                  {ticket.wisproClientName} • Contrato: <span className="font-mono text-sky-300">{ticket.wisproContractId}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="w-9 h-9 animate-spin text-sky-500" />
              <p className="text-sm font-medium">Consultando inventario vehicular y datos de Wispro...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm animate-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1">
                <p className="font-bold">Error en la operación</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-3 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 space-y-2">
                <p className="font-bold">{successMessage}</p>
                {auditEntries.length > 0 && (
                  <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-200/60 text-xs">
                    <p className="font-semibold text-emerald-900 mb-1">Movimientos registrados en Auditoría Forense:</p>
                    <ul className="space-y-0.5 text-emerald-700">
                      {auditEntries.map((e, idx) => (
                        <li key={idx}>✓ {e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && ticket && (
            <>
              {/* Tarjeta Informativa de la Orden y Técnico */}
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Ubicación & Nodo</span>
                    <span className="font-medium text-slate-800">{ticket.clientAddress}</span>
                    {ticket.wisproNode && (
                      <span className="text-sky-600 block font-medium mt-0.5">📍 {ticket.wisproNode}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Técnico / Cuadrilla</span>
                    <span className="font-medium text-slate-800">{ticket.technician?.name || ticket.technicianName || 'Sin asignar'}</span>
                    <span className="text-slate-500 block text-[11px]">{ticket.technician?.email || ''}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Truck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Bodega Móvil (Vehículo)</span>
                    <span className="font-medium text-slate-800">{ticket.vehicleWarehouse?.name || 'Móvil Asignado'}</span>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded font-mono text-[10px]">
                      Placa: {ticket.vehicleWarehouse?.code || 'VEH-01'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  CASO 1: LIQUIDACIÓN DE MATERIALES (Instalación, Visita, Factibilidad)
                  ───────────────────────────────────────────────────────────── */}
              {!isBaja && !ticket.wisproSynced && !successMessage && (
                <div className="space-y-5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">Liquidación de Materiales de Bodega Móvil</h3>
                        <p className="text-xs text-slate-500">Seleccione los equipos y metraje físico cargados en su vehículo</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                      ⚡ Transacción Atómica
                    </span>
                  </div>

                  {/* 1. Selección de Serial (ONU / Router) en Vehículo */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-sky-600" />
                        1. Equipo Terminal (ONU / Router) en Vehículo
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {availableSerials.length} equipos en móvil
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={serialSearch}
                        onChange={(e) => setSerialSearch(e.target.value)}
                        placeholder="Buscar por S/N o MAC cargado en móvil..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-sky-400 outline-none"
                      />
                    </div>

                    {availableSerials.length === 0 ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        No hay equipos serializados con estado <b>EN_VEHICULO</b> en esta cuadrilla.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {filteredSerials.map((item) => {
                          const isSelected = selectedSerial === item.serialNumber;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedSerial(isSelected ? '' : (item.serialNumber || ''))}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs
                                ${isSelected
                                  ? 'bg-sky-50/80 border-sky-400 ring-1 ring-sky-300 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                            >
                              <div className="mt-0.5">
                                <CategoryIcon category={item.product?.category} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">
                                  {item.product?.name || 'Equipo'}
                                </p>
                                <p className="font-mono text-[11px] text-slate-600 font-bold mt-0.5">
                                  S/N: {item.serialNumber}
                                </p>
                                {item.macAddress && (
                                  <p className="font-mono text-[10px] text-slate-400">
                                    MAC: {item.macAddress}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedSerial && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Equipo seleccionado: <span className="font-mono font-bold">{selectedSerial}</span> — Se amarrará al contrato {ticket.wisproContractId}.
                      </p>
                    )}
                  </div>

                  {/* 2. Metraje de Bobina Drop & Materiales a Granel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bobina de Cable Drop */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-amber-600" />
                        2. Bobina de Cable Drop (Metros)
                      </label>
                      {availableBatches.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={selectedBatchId}
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-slate-50 font-medium"
                          >
                            {availableBatches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.batchNumber} — {b.currentQuantity}m disponibles ({b.product?.name || 'Cable Drop'})
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Metros utilizados:</span>
                            <input
                              type="number"
                              min="0"
                              max={selectedBatch?.currentQuantity || 1000}
                              value={metersUsed}
                              onChange={(e) => setMetersUsed(Math.max(0, Number(e.target.value)))}
                              className="w-24 text-sm font-bold font-mono text-center rounded-lg border border-slate-200 p-1.5 focus:border-amber-400 outline-none"
                            />
                            <span className="text-xs font-semibold text-slate-600">m</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Remanente proyectado en bobina: <b className="text-slate-800">{projectedRemainingMeters}m</b>
                          </p>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded-lg">
                          No hay bobinas activas registradas en el vehículo.
                        </div>
                      )}
                    </div>

                    {/* Conectores y Accesorios a Granel */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                        3. Material a Granel Consumido
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Conectores SC/APC Rápidos:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConnectorsUsed(Math.max(0, connectorsUsed - 1))}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold font-mono">{connectorsUsed}</span>
                            <button
                              type="button"
                              onClick={() => setConnectorsUsed(connectorsUsed + 1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Tensores Drop Plásticos:</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTensorsUsed(Math.max(0, tensorsUsed - 1))}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold font-mono">{tensorsUsed}</span>
                            <button
                              type="button"
                              onClick={() => setTensorsUsed(tensorsUsed + 1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Observaciones de Cierre (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Instalación realizada con potencia óptica -19.4 dBm. Cliente satisfecho..."
                      className="w-full text-xs rounded-xl border border-slate-200 focus:border-sky-400 outline-none p-2.5 resize-none"
                    />
                  </div>

                  {/* Botón de Liquidación */}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all text-sm"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    ⚡ Procesar Liquidación y Amarrar a Wispro
                  </button>
                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  CASO 2: CHECKLIST DE RETIRO EN CAMPO (Baja de Servicio)
                  ───────────────────────────────────────────────────────────── */}
              {isBaja && !ticket.wisproSynced && !successMessage && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                    <h3 className="font-bold text-sm text-rose-800">
                      Checklist de Retiro — {detail.retrievalChecklist.length} equipo(s) en contrato {ticket.wisproContractId}
                    </h3>
                  </div>

                  {detail.retrievalChecklist.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                      No se encontraron equipos serializados activos vinculados a este contrato en la base de datos.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.retrievalChecklist.map((item) => {
                        const isDefective = defectiveIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => toggleDefective(item.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer text-xs
                              ${isDefective
                                ? 'bg-rose-50 border-rose-300'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <CategoryIcon category={item.product?.category} />
                              <div>
                                <p className="font-bold text-slate-800">{item.product?.name || 'Equipo'}</p>
                                <p className="font-mono text-slate-500 text-[11px]">S/N: {item.serialNumber} • MAC: {item.macAddress || 'N/A'}</p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] ${isDefective ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                              {isDefective ? 'Enviar a RMA Defectuoso' : 'Recuperar a Vehículo'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas de retiro..."
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Completar Baja y Retiro de Hardware
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">¿Confirmar liquidación atómica?</h3>
                <p className="text-xs text-slate-500">Esta acción actualizará inventarios y vinculará a Wispro.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1 text-slate-700 border border-slate-200">
              <p>• <b>Orden:</b> {ticket?.ticketNumber} ({ticket?.type})</p>
              <p>• <b>Cliente:</b> {ticket?.wisproClientName}</p>
              {!isBaja && selectedSerial && <p>• <b>Equipo:</b> S/N: {selectedSerial}</p>}
              {!isBaja && metersUsed > 0 && <p>• <b>Drop:</b> {metersUsed} metros</p>}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={processing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar y Liquidar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Componente Principal: Mesa de Órdenes & Vista de Despacho
// ─────────────────────────────────────────────────────────────────────────────

export const WorkOrdersModule: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dispatch' | 'table'>('dispatch');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  // Dispatch data
  const [dispatchData, setDispatchData] = useState<DispatchBoardResponse | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(true);

  // Table data
  const [orders, setOrders] = useState<InstallationTicket[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  // Carga de la Vista de Despacho
  const fetchDispatchBoard = useCallback(async () => {
    try {
      setDispatchLoading(true);
      setError(null);
      const res = await api.getDispatchBoard({
        date: dateFilter,
        typeFilter: typeFilter !== 'ALL' ? typeFilter : undefined
      });
      setDispatchData(res);
    } catch (err: any) {
      setError(err.message || 'Error al cargar la vista de despacho');
    } finally {
      setDispatchLoading(false);
    }
  }, [dateFilter, typeFilter]);

  // Carga de la Vista Tabla
  const fetchTableOrders = useCallback(async (p = 1) => {
    try {
      setTableLoading(true);
      setError(null);
      const params: Record<string, string> = {
        page: String(p),
        limit: '25'
      };
      if (typeFilter !== 'ALL') params.type = typeFilter;
      if (search.trim()) params.search = search.trim();

      const res = await api.getWorkOrders(params);
      setOrders(res.data || []);
      setPagination({
        total: res.pagination.total,
        totalPages: res.pagination.totalPages
      });
    } catch (err: any) {
      setError(err.message || 'Error al cargar listado de órdenes');
    } finally {
      setTableLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => {
    if (viewMode === 'dispatch') {
      fetchDispatchBoard();
    } else {
      fetchTableOrders(page);
    }
  }, [viewMode, dateFilter, typeFilter, fetchDispatchBoard, fetchTableOrders, page]);

  useEffect(() => {
    if (viewMode === 'table') {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchTableOrders(1);
        setPage(1);
      }, 350);
      return () => clearTimeout(debounceRef.current);
    }
  }, [search]);

  // Totales KPI
  const totalInBoard = dispatchData?.totalOrders || pagination.total;
  const totalInstalaciones = dispatchData?.groups.reduce((acc, g) => acc + g.stats.instalaciones, 0) || 0;
  const totalVisitas = dispatchData?.groups.reduce((acc, g) => acc + g.stats.visitas, 0) || 0;
  const totalFactibilidades = dispatchData?.groups.reduce((acc, g) => acc + g.stats.factibilidades, 0) || 0;
  const totalBajas = dispatchData?.groups.reduce((acc, g) => acc + g.stats.bajas, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                Mesa de Órdenes & Despacho
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Wispro Bridge Activo
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Control logístico de Altas, Visitas, Factibilidades y Bajas con asignación vehicular en tiempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Controles de Vista y Sincronización */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Switcher de Vista */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewMode('dispatch')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'dispatch'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Vista Despacho
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Listado General
            </button>
          </div>

          {/* Selector de Fecha */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            />
          </div>

          {/* Botón Refrescar */}
          <button
            onClick={() => (viewMode === 'dispatch' ? fetchDispatchBoard() : fetchTableOrders(page))}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dispatchLoading || tableLoading ? 'animate-spin' : ''}`} />
            Sincronizar Wispro
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Órdenes', value: totalInBoard, color: 'text-slate-800', bg: 'bg-white', border: 'border-slate-200' },
          { label: 'Instalaciones', value: totalInstalaciones, color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-200' },
          { label: 'Visitas Técnicas', value: totalVisitas, color: 'text-amber-700', bg: 'bg-amber-50/50', border: 'border-amber-200' },
          { label: 'Factibilidades', value: totalFactibilidades, color: 'text-sky-700', bg: 'bg-sky-50/50', border: 'border-sky-200' },
          { label: 'Bajas de Servicio', value: totalBajas, color: 'text-rose-700', bg: 'bg-rose-50/50', border: 'border-rose-200' }
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} p-3.5 rounded-2xl border ${kpi.border} shadow-sm`}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-black ${kpi.color} mt-0.5`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de Filtros por los 4 Tipos Estrictos */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
              typeFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todas las Órdenes
          </button>
          {STRICT_WORK_ORDER_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${
                typeFilter === t.value
                  ? `${t.bg} ${t.text} ${t.border} shadow-sm ring-1 ring-offset-1`
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {viewMode === 'table' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ticket, cliente, MAC..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:border-sky-400 outline-none"
            />
          </div>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 1: TABLERO DE DESPACHO (Agrupado por Técnico / Cuadrilla)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === 'dispatch' && (
        <div>
          {dispatchLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Cargando distribución de cuadrillas y órdenes...</p>
            </div>
          ) : !dispatchData || dispatchData.groups.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No hay cuadrillas ni órdenes para mostrar</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grid de Columnas por Técnico */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {dispatchData.groups.map((group) => {
                  const tech = group.technician;
                  const vehicle = group.vehicle;
                  const orders = group.orders;

                  return (
                    <div
                      key={tech.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:border-slate-300 transition-colors"
                    >
                      {/* Cabecera de la Tarjeta del Técnico */}
                      <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-bold text-sm">
                              {tech.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-white">{tech.name}</h3>
                              <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                                <Truck className="w-3 h-3 text-sky-400" />
                                {vehicle?.name || 'Móvil Asignado'} • <span className="font-mono text-sky-300">Placa {vehicle?.vehiclePlate || 'N/A'}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-sky-500 text-white shadow-sm">
                            {group.stats.total} orden{group.stats.total !== 1 ? 'es' : ''}
                          </span>
                        </div>

                        {/* Stock Disponible en su Vehículo */}
                        {vehicle && (
                          <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] text-slate-300 border-t border-slate-700/60">
                            <div className="bg-slate-800/80 rounded-lg px-2 py-1">
                              <span className="text-slate-400 block text-[9px] uppercase font-semibold">ONUs en Móvil</span>
                              <span className="font-bold text-sky-300">{vehicle.serializedCount} unid.</span>
                            </div>
                            <div className="bg-slate-800/80 rounded-lg px-2 py-1">
                              <span className="text-slate-400 block text-[9px] uppercase font-semibold">Cable Drop</span>
                              <span className="font-bold text-amber-300">
                                {vehicle.batchSummary?.[0]?.currentQuantity || 0}m
                              </span>
                            </div>
                            <div className="bg-slate-800/80 rounded-lg px-2 py-1">
                              <span className="text-slate-400 block text-[9px] uppercase font-semibold">Conectores</span>
                              <span className="font-bold text-emerald-300">
                                {vehicle.bulkSummary?.[0]?.quantity || 20} unid.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Resumen de Zonas y Fecha */}
                        <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> Fecha:
                            </span>
                            <span className="font-medium text-slate-200">
                              {new Date().toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-start gap-1 text-[11px]">
                            <MapPin className="w-3 h-3 text-sky-400 mt-0.5 shrink-0" />
                            <div className="flex-1 flex flex-wrap gap-1">
                              {group.zones && group.zones.length > 0 ? (
                                group.zones.map((z, idx) => (
                                  <span key={idx} className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-300">
                                    {z}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[10px]">Sin zonas fijas</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Órdenes del Técnico */}
                      <div className="p-3 flex-1 space-y-2.5 overflow-y-auto max-h-[420px] bg-slate-50/50">
                        {orders.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 text-xs">
                            No hay órdenes programadas para este técnico hoy.
                          </div>
                        ) : (
                          orders.map((order) => {
                            const isCompleted = order.wisproSynced;
                            return (
                              <div
                                key={order.id}
                                className={`bg-white rounded-xl p-3 border transition-all shadow-sm space-y-2 ${
                                  isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-sky-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-bold text-slate-800">
                                        {order.ticketNumber}
                                      </span>
                                      <TypeBadge type={order.type} />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-900 mt-1">
                                      {order.wisproClientName}
                                    </p>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      isCompleted
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {isCompleted ? 'Completada' : 'Pendiente'}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-500 space-y-0.5">
                                  <p className="flex items-center gap-1 truncate">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    {order.clientAddress}
                                  </p>
                                  <p className="text-[10px] font-mono text-slate-400">
                                    Contrato: <b className="text-slate-700">{order.wisproContractId}</b>
                                  </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                  <button
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition-colors"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                                    {isCompleted ? 'Ver Liquidación' : 'Gestionar / Liquidar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sección de Órdenes Sin Asignar */}
              {dispatchData.unassigned && dispatchData.unassigned.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">
                          Órdenes Sin Asignar ({dispatchData.unassigned.length})
                        </h3>
                        <p className="text-xs text-slate-500">Tickets entrantes desde Wispro pendientes de despacho a cuadrilla</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dispatchData.unassigned.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 hover:border-amber-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-800">{ord.ticketNumber}</span>
                          <TypeBadge type={ord.type} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 truncate">{ord.wisproClientName}</p>
                          <p className="text-[11px] text-slate-500 truncate">{ord.clientAddress}</p>
                        </div>
                        <button
                          onClick={() => setSelectedOrderId(ord.id)}
                          className="w-full py-1 text-xs font-semibold bg-white border border-slate-200 hover:border-sky-300 text-slate-700 rounded-lg transition-colors"
                        >
                          Ver y Despachar →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISTA 2: LISTADO GENERAL (Tabla Clásica con Búsqueda y Paginación)
          ───────────────────────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {tableLoading && orders.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No se encontraron órdenes con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Cliente / Contrato</th>
                    <th className="px-4 py-3">Técnico / Móvil</th>
                    <th className="px-4 py-3">Ubicación / Nodo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{ord.ticketNumber}</td>
                      <td className="px-4 py-3">
                        <TypeBadge type={ord.type} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{ord.wisproClientName}</p>
                        <p className="font-mono text-slate-400 text-[10px]">{ord.wisproContractId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700 font-medium">
                          {ord.technician?.name || ord.technicianName || 'Sin asignar'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{ord.clientAddress}</td>
                      <td className="px-4 py-3">
                        {ord.wisproSynced ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Completada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Loader2 className="w-3 h-3" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrderId(ord.id)}
                          className="px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold rounded-lg transition-colors"
                        >
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
              <span className="text-slate-500">
                Página {page} de {pagination.totalPages} ({pagination.total} órdenes)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 bg-white disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalle y Liquidación */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onCompleted={() => {
            if (viewMode === 'dispatch') fetchDispatchBoard();
            else fetchTableOrders(page);
          }}
        />
      )}
    </div>
  );
};

export default WorkOrdersModule;
