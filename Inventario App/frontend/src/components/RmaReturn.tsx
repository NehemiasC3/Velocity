import React, { useEffect, useState } from 'react';
import { 
  RotateCcw, QrCode, Search, AlertTriangle, CheckCircle2, 
  Truck, User, MapPin, Zap, ShieldAlert, Sparkles, 
  Layers, Package, Check, RefreshCw, X, ArrowDownRight,
  Flame, XCircle, RefreshCwOff, WifiOff
} from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, SerializedItem } from '../types';

export const RmaReturn: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Form selections
  const [vehicles, setVehicles] = useState<Warehouse[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [reason, setReason] = useState('DANO_ELECTRICO');
  const [deviceCondition, setDeviceCondition] = useState<'DEFECTUOSO_RMA' | 'OPERATIVO_BUENO'>('DEFECTUOSO_RMA');
  const [notes, setNotes] = useState('');

  // Submission & History
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rmaHistory, setRmaHistory] = useState<SerializedItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadInitialData = async () => {
    try {
      setLoadingHistory(true);
      const [whRes, rmaRes] = await Promise.all([
        api.getWarehouses(),
        api.getRmaItems().catch(() => ({ items: [] }))
      ]);

      const vList = (whRes.warehouses || []).filter(w => w.type === 'VEHICULO' || w.type === 'SUCURSAL');
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }

      setRmaHistory(rmaRes.items || []);
    } catch (err) {
      console.error('Error cargando datos de RMA:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Consultar MAC en tiempo real
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim().toUpperCase();
    if (!clean) return;

    try {
      setLoadingLookup(true);
      setLookupError(null);
      setDeviceInfo(null);

      const res = await api.lookupRmaDevice(clean);
      setDeviceInfo(res);
    } catch (err: any) {
      setLookupError(err.message || 'No se encontró el equipo');
    } finally {
      setLoadingLookup(false);
    }
  };

  // Procesar Retiro / Devolución
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMac = deviceInfo?.item?.macAddress || query.trim().toUpperCase();

    if (!targetMac) {
      setToastMessage({ type: 'error', text: 'Debe ingresar y buscar una dirección MAC válida' });
      return;
    }

    try {
      setIsSubmitting(true);
      setToastMessage(null);

      const res = await api.returnRmaEquipment({
        macAddress: targetMac,
        vehicleWarehouseId: selectedVehicleId || undefined,
        reason,
        deviceCondition,
        notes: notes.trim() || undefined
      });

      setToastMessage({ type: 'success', text: res.message });
      setDeviceInfo(null);
      setQuery('');
      setNotes('');

      // Recargar historial
      const updatedRma = await api.getRmaItems();
      setRmaHistory(updatedRma.items || []);

      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Error al registrar recuperación' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const REASON_OPTIONS = [
    {
      id: 'DANO_ELECTRICO',
      label: 'Quemado / Rayo / Falla Eléctrica',
      icon: Flame,
      color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
      badge: '🌩️ Eléctrico'
    },
    {
      id: 'CANCELACION',
      label: 'Cancelación de Servicio / Retiro',
      icon: XCircle,
      color: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200',
      badge: '❌ Retiro'
    },
    {
      id: 'FALLA_PUERTO',
      label: 'Falla Óptica / Puerto PON o LAN Dañado',
      icon: WifiOff,
      color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200',
      badge: '🔌 Hardware'
    },
    {
      id: 'ACTUALIZACION',
      label: 'Upgrade / Cambio a WiFi 6 o Mesh',
      icon: RefreshCw,
      color: 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200',
      badge: '🔄 Upgrade'
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
                Logística Inversa & Recuperación de Equipos (RMA)
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold">
                Retiros en Campo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Desvinculación instantánea de clientes, control de cuarentena y auditoría de equipos retirados
            </p>
          </div>
        </div>

        <button
          onClick={loadInitialData}
          title="Refrescar datos"
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
        </button>
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
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── Formulario Principal de Retiro ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Escáner y Datos del Equipo (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <QrCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                1. Escanear o Escribir MAC del Equipo Retirado
              </h3>
            </div>

            {/* Input Escáner con botón de búsqueda rápida */}
            <form onSubmit={handleLookup} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Escanear MAC o Serial del equipo en pared (Ej. F4:8E:38:11:22:33)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono uppercase text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={loadingLookup || !query.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center gap-2 transition"
              >
                {loadingLookup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Buscar</span>
              </button>
            </form>

            {/* Error si no se encuentra */}
            {lookupError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{lookupError}</span>
              </div>
            )}

            {/* Tarjeta de Confirmación de Propietario / Cliente */}
            {deviceInfo && (
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Equipo Identificado en Sistema</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-200/80 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 font-bold">
                    Estado: {deviceInfo.item?.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase">Dispositivo</p>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {deviceInfo.item?.product?.name || deviceInfo.item?.brand}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                      MAC: <strong className="text-purple-700 dark:text-purple-300">{deviceInfo.item?.macAddress}</strong>
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      S/N: {deviceInfo.item?.serialNumber}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase">Cliente Vinculado</p>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-purple-500" />
                      <span>{deviceInfo.installedClientName}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ticket Wispro: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{deviceInfo.installedTicketId}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Ubicación previa: {deviceInfo.currentLocation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. MOTIVO DEL RETIRO (RADIO BUTTONS VISUALES) ── */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                2. Motivo del Retiro / Diagnóstico en Terreno *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {REASON_OPTIONS.map((opt) => {
                  const isSelected = reason === opt.id;
                  const Icon = opt.icon;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReason(opt.id)}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        isSelected
                          ? `${opt.color} border-2 shadow-xs scale-[1.01]`
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-white/80 dark:bg-slate-900/80 shadow-xs' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{opt.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ml-auto" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          {opt.label}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 3. CONDICIÓN FÍSICA Y VEHÍCULO ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  3. Condición del Equipo & Destino
                </label>
                <select
                  value={deviceCondition}
                  onChange={(e) => setDeviceCondition(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="DEFECTUOSO_RMA">⚠️ Dañado / Falla (Enviar a Cuarentena RMA)</option>
                  <option value="OPERATIVO_BUENO">✅ Operativo / Bueno (Custodia en Camioneta)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Cuadrilla / Vehículo que Retira *
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      🚚 {v.name} ({v.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Observaciones Técnicas (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Sin cargador original, cliente indica corte de luz previo."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Botón de Retiro */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmitReturn}
                disabled={isSubmitting || (!deviceInfo && !query.trim())}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                <span>Registrar Recuperación de Equipo (RMA)</span>
              </button>
            </div>

          </div>
        </div>

        {/* Columna Derecha: Depósito de Cuarentena & Historial Reciente (1 col) */}
        <div className="space-y-4">
          
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-heading font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>Equipos en Cuarentena ({rmaHistory.length})</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">RMA Stock</span>
            </div>

            {rmaHistory.length === 0 ? (
              <p className="text-center text-slate-400 italic text-xs py-6">
                No hay equipos en cuarentena RMA actualmente.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {rmaHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 text-xs">
                        {item.macAddress}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                        {item.status}
                      </span>
                    </div>

                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                      {item.product?.name || item.brand}
                    </p>

                    <p className="text-[10px] text-slate-500 line-clamp-2 italic">
                      {item.notes || 'Sin observaciones'}
                    </p>

                    <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                      <span>Ubicación:</span>
                      <strong>{item.currentWarehouse?.name || 'Cuarentena'}</strong>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
