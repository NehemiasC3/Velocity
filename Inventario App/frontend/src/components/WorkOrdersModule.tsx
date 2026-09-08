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
  HardDrive
} from 'lucide-react';
import {
  InstallationTicket,
  InstallationTicketType,
  WorkOrderDetail,
  WorkOrderRetrievalItem,
  WorkOrderListResponse
} from '../types';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Badge de tipo de orden
// ─────────────────────────────────────────────────────────────────────────────

interface BadgeConfig {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
  border: string;
}

function getTypeBadge(type: InstallationTicketType): BadgeConfig {
  switch (type) {
    case 'INSTALACION_NUEVA':
      return {
        label: 'Alta / Instalación',
        icon: <ArrowUpCircle className="w-3.5 h-3.5" />,
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-300'
      };
    case 'BAJA_SERVICIO':
      return {
        label: 'Baja / Cancelación',
        icon: <ArrowDownCircle className="w-3.5 h-3.5" />,
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-300'
      };
    case 'MANTENIMIENTO_RMA':
      return {
        label: 'RMA / Cambio Equipo',
        icon: <Wrench className="w-3.5 h-3.5" />,
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-300'
      };
    case 'CAMBIO_EQUIPO':
      return {
        label: 'Cambio de Equipo',
        icon: <Wrench className="w-3.5 h-3.5" />,
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-300'
      };
    case 'MIGRACION':
      return {
        label: 'Migración',
        icon: <RefreshCw className="w-3.5 h-3.5" />,
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        border: 'border-violet-300'
      };
    default:
      return {
        label: type.replace(/_/g, ' '),
        icon: <ClipboardList className="w-3.5 h-3.5" />,
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-300'
      };
  }
}

function TypeBadge({ type }: { type: InstallationTicketType }) {
  const cfg = getTypeBadge(type);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Íconos por categoría de equipo
// ─────────────────────────────────────────────────────────────────────────────

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
// Modal de detalle de orden
// ─────────────────────────────────────────────────────────────────────────────

interface OrderDetailModalProps {
  orderId: string;
  onClose: () => void;
  onCompleted: () => void;
}

function OrderDetailModal({ orderId, onClose, onCompleted }: OrderDetailModalProps) {
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defectiveIds, setDefectiveIds] = useState<Set<string>>(new Set());
  const [completeNotes, setCompleteNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [completionResult, setCompletionResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await api.getWorkOrderDetail(orderId);
        setDetail(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const toggleDefective = (id: string) => {
    setDefectiveIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleComplete = async () => {
    try {
      setCompleting(true);
      setError(null);
      const result = await api.completeWorkOrder(orderId, {
        defectiveItemIds: Array.from(defectiveIds),
        notes: completeNotes
      });
      setCompletionResult(result);
      onCompleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCompleting(false);
      setShowConfirm(false);
    }
  };

  const ticket = detail?.ticket;
  const checklist = detail?.retrievalChecklist ?? [];
  const isBaja = ticket?.type === 'BAJA_SERVICIO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-slate-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {loading ? 'Cargando orden...' : `Orden ${ticket?.ticketNumber}`}
              </h2>
              {ticket && (
                <p className="text-xs text-slate-500">{ticket.wisproClientName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {completionResult && (
            <div className="flex items-start gap-3 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-sm">
              <PackageCheck className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{completionResult.message}</p>
                {completionResult.summary && (
                  <ul className="mt-1 text-xs space-y-0.5">
                    <li>• Total retirados: {completionResult.summary.totalRetrieved}</li>
                    <li>• En vehículo: {completionResult.summary.movedToVehicle}</li>
                    <li>• RMA/Defectuosos: {completionResult.summary.movedToRMA}</li>
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && ticket && (
            <>
              {/* Tipo + Info general */}
              <div className="flex flex-wrap items-center gap-3">
                <TypeBadge type={ticket.type} />
                {ticket.wisproSynced && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    Completada
                  </span>
                )}
              </div>

              {/* Datos del contrato */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Contrato Wispro</span>
                  <span className="font-mono text-slate-800 font-semibold">{ticket.wisproContractId}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Cliente</span>
                  <span className="text-slate-800">{ticket.wisproClientName}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dirección
                  </span>
                  <span className="text-slate-700">{ticket.clientAddress}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3 h-3" /> Técnico
                  </span>
                  <span className="text-slate-700">
                    {ticket.technician?.name || ticket.technicianName || '—'}
                  </span>
                </div>
                {ticket.wisproNode && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Nodo</span>
                    <span className="text-slate-700">{ticket.wisproNode}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Creada
                  </span>
                  <span className="text-slate-700">{new Date(ticket.createdAt).toLocaleDateString('es-PA')}</span>
                </div>
              </div>

              {ticket.notes && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-600">
                  <span className="font-medium text-slate-500">Notas:</span> {ticket.notes}
                </div>
              )}

              {/* ── Checklist de Retiro (solo BAJA_SERVICIO) ── */}
              {isBaja && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <h3 className="font-bold text-sm text-rose-700">
                      Checklist de Retiro — {checklist.length} equipo{checklist.length !== 1 ? 's' : ''} en campo
                    </h3>
                  </div>

                  {checklist.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                      <CheckCircle2 className="w-4 h-4" />
                      Sin equipos activos asignados a este contrato. Ya fueron retirados.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {checklist.map((item) => {
                        const isDefective = defectiveIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors cursor-pointer select-none
                              ${isDefective
                                ? 'bg-rose-50 border-rose-300'
                                : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
                              }`}
                            onClick={() => toggleDefective(item.id)}
                          >
                            <div className="mt-0.5 shrink-0">
                              <CategoryIcon category={item.product?.category} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {item.product?.name || 'Equipo'}{' '}
                                {item.product?.brand && (
                                  <span className="font-normal text-slate-500">{item.product.brand}</span>
                                )}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                                {item.serialNumber && <span>S/N: <span className="font-mono text-slate-700">{item.serialNumber}</span></span>}
                                {item.macAddress && <span>MAC: <span className="font-mono text-slate-700">{item.macAddress}</span></span>}
                                {item.currentWarehouse && <span>📍 {item.currentWarehouse.name}</span>}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              {isDefective ? (
                                <span className="text-xs font-semibold text-rose-600 bg-rose-100 rounded-full px-2 py-0.5">
                                  RMA
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Recuperar</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-xs text-slate-400 mt-1">
                        Toca un equipo para marcarlo como defectuoso (irá a RMA). Los demás van al vehículo.
                      </p>
                    </div>
                  )}

                  {/* Notas de completado */}
                  {!ticket.wisproSynced && !completionResult && (
                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Notas de cierre (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={completeNotes}
                        onChange={(e) => setCompleteNotes(e.target.value)}
                        placeholder="Ej: Cliente entregó equipos en buen estado..."
                        className="w-full text-sm rounded-xl border border-slate-200 focus:border-rose-400 focus:ring-1 focus:ring-rose-300 outline-none px-3 py-2 resize-none transition-colors"
                      />
                      <button
                        onClick={() => setShowConfirm(true)}
                        disabled={completing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                      >
                        {completing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Completar Baja de Servicio
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Completar para órdenes de alta/mantenimiento */}
              {!isBaja && !ticket.wisproSynced && !completionResult && (
                <div className="mt-4 space-y-3">
                  <textarea
                    rows={2}
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    placeholder="Notas de cierre..."
                    className="w-full text-sm rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none px-3 py-2 resize-none transition-colors"
                  />
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={completing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                  >
                    {completing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Marcar como Completada
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0" />
              <h3 className="font-bold text-slate-800">¿Confirmar cierre de orden?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              Esta acción es irreversible y actualizará el inventario.
            </p>
            {isBaja && defectiveIds.size > 0 && (
              <p className="text-sm text-rose-600 mb-4">
                {defectiveIds.size} equipo{defectiveIds.size !== 1 ? 's' : ''} marcado{defectiveIds.size !== 1 ? 's' : ''} como defectuoso{defectiveIds.size !== 1 ? 's' : ''} (RMA).
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors disabled:opacity-50"
              >
                {completing ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'INSTALACION_NUEVA', label: '🟢 Altas' },
  { value: 'BAJA_SERVICIO', label: '🔴 Bajas' },
  { value: 'MANTENIMIENTO_RMA', label: '🔧 RMA' },
  { value: 'CAMBIO_EQUIPO', label: '⚙️ Cambio Equipo' },
  { value: 'MIGRACION', label: '🔄 Migración' }
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export const WorkOrdersModule: React.FC = () => {
  const [orders, setOrders] = useState<InstallationTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  const fetchOrders = useCallback(async (q?: string, t?: string, p?: number) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string> = {
        page: String(p ?? page),
        limit: '25'
      };
      if (t && t !== 'ALL') params.type = t;
      if (q && q.trim()) params.search = q.trim();

      const data: WorkOrderListResponse = await api.getWorkOrders(params);
      setOrders(data.data ?? []);
      setPagination({
        total: data.pagination.total,
        totalPages: data.pagination.totalPages
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchOrders(search, typeFilter, 1);
    setPage(1);
  }, [typeFilter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchOrders(search, typeFilter, 1);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    fetchOrders(search, typeFilter, page);
  }, [page]);

  const stats = {
    total: pagination.total,
    altas: orders.filter((o) => o.type === 'INSTALACION_NUEVA').length,
    bajas: orders.filter((o) => o.type === 'BAJA_SERVICIO').length,
    pendientes: orders.filter((o) => !o.wisproSynced).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-sky-600" />
            Mesa de Órdenes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión de Altas, Bajas y Mantenimiento de servicios en campo
          </p>
        </div>
        <button
          onClick={() => fetchOrders(search, typeFilter, page)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Órdenes', value: pagination.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Altas', value: stats.altas, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Bajas', value: stats.bajas, color: 'text-rose-700', bg: 'bg-rose-50' },
          { label: 'Pendientes', value: stats.pendientes, color: 'text-amber-700', bg: 'bg-amber-50' }
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl px-4 py-3 border border-slate-100`}>
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ticket, cliente, contrato, MAC..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:border-sky-400 focus:ring-1 focus:ring-sky-300 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap
                ${typeFilter === f.value
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No hay órdenes que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Ticket</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Cliente / Contrato</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Técnico</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Fecha</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const isBaja = order.type === 'BAJA_SERVICIO';
                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`border-b border-slate-50 hover:bg-slate-50/70 transition-colors
                          ${isBaja ? 'bg-rose-50/20' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-slate-700 text-xs">
                            {order.ticketNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <TypeBadge type={order.type} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 truncate max-w-[160px]">
                            {order.wisproClientName}
                          </div>
                          <div className="text-xs font-mono text-slate-400 truncate">
                            {order.wisproContractId}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-slate-600">
                            {order.technician?.name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString('es-PA')}
                        </td>
                        <td className="px-4 py-3">
                          {order.wisproSynced ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Completada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                              <Loader2 className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedOrderId(order.id)}
                              title="Ver detalle"
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isBaja && (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                title="Expandir checklist"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Fila expandible para BAJA con resumen */}
                      {isExpanded && isBaja && (
                        <tr className="border-b border-rose-100 bg-rose-50/40">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="flex items-center gap-2 text-sm text-rose-700">
                              <ShieldAlert className="w-4 h-4 shrink-0" />
                              <span className="font-medium">
                                Orden de Baja — abre el detalle para ver el checklist completo de retiro de hardware.
                              </span>
                              <button
                                onClick={() => setSelectedOrderId(order.id)}
                                className="ml-auto text-xs text-white bg-rose-600 hover:bg-rose-700 px-3 py-1 rounded-lg font-semibold transition-colors"
                              >
                                Abrir Checklist →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
            <span className="text-xs text-slate-500">
              {pagination.total} órdenes — Página {page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onCompleted={() => {
            fetchOrders(search, typeFilter, page);
          }}
        />
      )}
    </div>
  );
};

export default WorkOrdersModule;
