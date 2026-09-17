import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  X,
  Package,
  Truck,
  Wifi,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  Clock,
  Loader2,
  Copy,
  Check,
  Boxes,
  FileText,
  Activity
} from 'lucide-react';
import { api } from '../services/api';
import { AuditLog, SerializedItem, WisproClient } from '../types';

interface ForensicTimelineModalProps {
  serialOrMac: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TimelineData {
  found: boolean;
  item?: {
    id: string;
    macAddress?: string;
    serialNumber?: string;
    category?: string;
    brand?: string;
    model?: string;
    status: string;
    currentWarehouseId?: string;
    currentWarehouseName?: string;
  };
  clientData?: WisproClient | null;
  timeline: AuditLog[];
}

export const ForensicTimelineModal: React.FC<ForensicTimelineModalProps> = ({
  serialOrMac,
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !serialOrMac) {
      setData(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getSerializedItemTimeline(serialOrMac.trim());
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Error al consultar trazabilidad forense');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, serialOrMac]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'ALTA_INVENTARIO':
        return {
          label: 'Ingreso a Bodega Central',
          icon: <Package className="w-4 h-4 text-emerald-500" />,
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'DESPACHO_TRASLADO':
      case 'CARGA_VEHICULO':
        return {
          label: 'Asignación / Traslado a Vehículo',
          icon: <Truck className="w-4 h-4 text-sky-500" />,
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          dot: 'bg-sky-500'
        };
      case 'INSTALACION_CLIENTE':
        return {
          label: 'Instalación en Cliente (Wispro)',
          icon: <Wifi className="w-4 h-4 text-indigo-500" />,
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-500'
        };
      case 'RETIRO_CLIENTE':
      case 'RETIRO_POR_CANCELACION':
        return {
          label: 'Retiro en Campo / Desconexión',
          icon: <RotateCcw className="w-4 h-4 text-rose-500" />,
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500'
        };
      case 'REPORTE_RMA':
        return {
          label: 'Derivación a Laboratorio RMA',
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500'
        };
      default:
        return {
          label: type.replace(/_/g, ' '),
          icon: <Activity className="w-4 h-4 text-slate-500" />,
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500'
        };
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const st = status.toUpperCase();
    if (st.includes('BODEGA')) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">EN BODEGA</span>;
    if (st.includes('VEHICULO')) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">EN VEHÍCULO / CUADRILLA</span>;
    if (st.includes('CLIENTE') || st.includes('INSTALADO')) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">INSTALADO CLIENTE</span>;
    if (st.includes('RMA')) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">RMA / DEFECTUOSO</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
  };

  const item = data?.item;
  const client = data?.clientData;
  const timeline = data?.timeline || [];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Línea de Tiempo Forense</h2>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Audit Ledger 100%
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Identificador: {serialOrMac}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Loader2 className="w-9 h-9 animate-spin text-sky-500" />
              <p className="text-xs font-semibold">Consultando bloques de auditoría y ciclo de vida...</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold">Error en la consulta forense</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Tarjeta del Equipo y Ubicación Actual */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Equipo</span>
                    {getStatusBadge(item?.status)}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {item?.brand || ''} {item?.model || item?.category || 'Equipo Serializado'}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-slate-600 font-mono text-[11px] pt-1">
                    {item?.serialNumber && (
                      <span
                        onClick={() => copyToClipboard(item.serialNumber!)}
                        className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 cursor-pointer hover:border-sky-300"
                        title="Copiar Serial"
                      >
                        S/N: <b>{item.serialNumber}</b>
                        {copied === item.serialNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      </span>
                    )}
                    {item?.macAddress && (
                      <span
                        onClick={() => copyToClipboard(item.macAddress!)}
                        className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 cursor-pointer hover:border-sky-300"
                        title="Copiar MAC"
                      >
                        MAC: <b>{item.macAddress}</b>
                        {copied === item.macAddress ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 md:pl-4">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                    Ubicación / Asignación Actual
                  </span>
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    {item?.currentWarehouseName || 'Asignado a Cliente'}
                  </p>
                  {client && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
                      <p className="text-slate-500 font-semibold">Cliente Wispro:</p>
                      <p className="font-bold text-slate-900">{client.name}</p>
                      <p className="font-mono text-slate-500 text-[10px]">Contrato: <b className="text-sky-700">{client.contractId}</b> • {client.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Línea de Tiempo Visual (Timeline) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    Historial Completo de Movimientos ({timeline.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Orden cronológico ascendente</span>
                </div>

                {timeline.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                    No se encontraron registros de auditoría para este número de serie.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {timeline.map((event, index) => {
                      const cfg = getEventBadge(event.eventType);
                      const isLast = index === timeline.length - 1;

                      return (
                        <div key={event.id || index} className="relative group">
                          {/* Timeline Dot */}
                          <div
                            className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${cfg.dot}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          {/* Event Card */}
                          <div
                            className={`p-4 rounded-2xl border transition-all ${
                              isLast
                                ? 'bg-white border-indigo-300 ring-2 ring-indigo-100 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.bg}`}>
                                {cfg.icon}
                                {cfg.label}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(event.timestamp).toLocaleString('es-PA', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {/* Details Text */}
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                              {event.details}
                            </p>

                            {/* Meta Info */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-slate-700 font-semibold">
                                  <User className="w-3 h-3 text-slate-400" />
                                  {event.userName || 'Sistema'}
                                </span>
                                {event.fromWarehouseName && (
                                  <span className="text-slate-500">
                                    De: <b className="text-slate-700">{event.fromWarehouseName}</b>
                                  </span>
                                )}
                                {event.toWarehouseName && (
                                  <span className="text-slate-500">
                                    ➔ A: <b className="text-slate-700">{event.toWarehouseName}</b>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-emerald-600 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                ✓ Verificado en Ledger
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Sistema de Auditoría Forense ISP Velocity</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors"
          >
            Cerrar Visor Forense
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForensicTimelineModal;
