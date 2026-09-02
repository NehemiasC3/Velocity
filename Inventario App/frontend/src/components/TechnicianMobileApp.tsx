import React, { useEffect, useState } from 'react';
import { 
  Truck, QrCode, CheckCircle2, Wifi, Camera, 
  Package, AlertTriangle, ShieldCheck, RefreshCw,
  Send, Layers, Sparkles, Smartphone, ArrowRight, UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { Warehouse, SerializedItem, BulkStock, WisproClient } from '../types';
import { useAuth } from '../context/AuthContext';

export const TechnicianMobileApp: React.FC = () => {
  const { currentUser, switchUser } = useAuth();
  const [vehicle, setVehicle] = useState<Warehouse | null>(null);
  const [onusInVehicle, setOnusInVehicle] = useState<SerializedItem[]>([]);
  const [bulkStocks, setBulkStocks] = useState<BulkStock[]>([]);
  const [pendingClients, setPendingClients] = useState<WisproClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedMac, setSelectedMac] = useState('');
  const [dropMeters, setDropMeters] = useState(65);
  const [connectors, setConnectors] = useState(2);
  const [tensors, setTensors] = useState(2);
  const [techNotes, setTechNotes] = useState('Instalación en sala principal. Potencia óptica -19.1 dBm.');
  const [photoUrl, setPhotoUrl] = useState('https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800');
  
  // Scanning simulator
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Offline simulation toggle
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vehRes, cliRes] = await Promise.all([
        api.getMyVehicleStock().catch(() => null),
        api.getWisproClients({ status: 'PENDIENTE_INSTALACION' })
      ]);

      if (vehRes) {
        setVehicle(vehRes.warehouse);
        setOnusInVehicle(vehRes.serializedItems);
        setBulkStocks(vehRes.bulkStocks);
        if (vehRes.serializedItems.length > 0) {
          setSelectedMac(vehRes.serializedItems[0].macAddress);
        }
      }

      setPendingClients(cliRes.clients);
      if (cliRes.clients.length > 0) {
        setSelectedClientId(cliRes.clients[0].id);
      }
    } catch (err) {
      console.error('Error cargando app móvil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      if (onusInVehicle.length > 0) {
        setSelectedMac(onusInVehicle[0].macAddress);
      }
      setIsScanning(false);
    }, 1200);
  };

  const handleCloseTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      alert('Debes seleccionar un cliente de Wispro');
      return;
    }
    if (!selectedMac) {
      alert('Debes escanear o seleccionar una ONU');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await api.closeTicket({
        wisproClientId: selectedClientId,
        installedOnuMac: selectedMac,
        cableDropMetersUsed: Number(dropMeters),
        connectorsUsed: Number(connectors),
        tensorsUsed: Number(tensors),
        installationPhotoUrl: photoUrl,
        notes: techNotes
      });

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      setSuccessResult(res.ticket);
      loadData();
    } catch (err: any) {
      alert(`Error al cerrar ticket: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClient = pendingClients.find(c => c.id === selectedClientId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Mobile Device Frame Header */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-white">
                  {vehicle?.name || 'Camioneta del Técnico'}
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                  {vehicle?.vehiclePlate || 'Móvil'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Técnico: <strong className="text-slate-200">{currentUser?.name}</strong>
              </p>
            </div>
          </div>

          {/* Quick Switch to Tech Leader if not selected */}
          {currentUser?.role !== 'TECNICO_LIDER' && (
            <button
              onClick={() => switchUser('usr-tec-lider-1')}
              className="text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-bold px-2.5 py-1.5 rounded-lg transition"
            >
              Cambiar a Carlos Mendoza
            </button>
          )}
        </div>

        {/* Van Stock Summary Quick Bar */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block uppercase font-semibold">ONUs a Bordo</span>
            <span className="text-lg font-heading font-extrabold text-emerald-400 font-mono">
              {onusInVehicle.length}
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block uppercase font-semibold">Cable Drop</span>
            <span className="text-lg font-heading font-extrabold text-sky-400 font-mono">
              {bulkStocks.find(s => s.bulkItemId === 'blk-cable-drop-1h')?.quantity || 0}m
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] block uppercase font-semibold">Conectores</span>
            <span className="text-lg font-heading font-extrabold text-indigo-400 font-mono">
              {bulkStocks.find(s => s.bulkItemId === 'blk-conector-scapc')?.quantity || 0}
            </span>
          </div>
        </div>

      </div>

      {/* Success Modal / Banner when installation completed */}
      {successResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 rounded-3xl p-6 shadow-xl text-slate-900 dark:text-white space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-emerald-900 dark:text-emerald-200">
                ¡Instalación Finalizada & Wispro Aprovisionado!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Ticket: <strong className="font-mono">{successResult.ticketNumber}</strong> • Stock descontado en tiempo real.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{successResult.wisproClientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ONU MAC inyectada:</span>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{successResult.installedOnuMac}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Materiales utilizados:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {successResult.cableDropMetersUsed}m drop, {successResult.connectorsUsed} conectores
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successResult.wisproSyncMessage}</span>
            </div>
          </div>

          <button
            onClick={() => setSuccessResult(null)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl transition"
          >
            Realizar Otra Instalación
          </button>
        </div>
      )}

      {/* Main Installation Form */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
        
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-sky-500" />
              <span>Cierre de Ticket de Instalación</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Offline-First PWA</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona el cliente de Wispro, escanea la ONU y confirma el metraje de drop.
          </p>
        </div>

        <form onSubmit={handleCloseTicket} className="space-y-5 text-xs">
          
          {/* Step 1: Select Wispro Client */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
              <span>1. Cliente Asignado (Desde Wispro) *</span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-normal">GET /api/v1/clients</span>
            </label>

            {pendingClients.length === 0 ? (
              <p className="text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                No hay clientes pendientes de instalación en Wispro.
              </p>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
              >
                {pendingClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.address} ({c.planName})
                  </option>
                ))}
              </select>
            )}

            {selectedClient && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-xl text-[11px] text-sky-900 dark:text-sky-200 space-y-1">
                <div className="flex justify-between">
                  <span>Contrato: <strong className="font-mono">{selectedClient.contractId}</strong></span>
                  <span>Nodo: <strong>{selectedClient.nodeName}</strong></span>
                </div>
                <div>Plan: <strong>{selectedClient.planName}</strong></div>
              </div>
            )}
          </div>

          {/* Step 2: Scan ONU MAC */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              2. Escanear Código de Barras / QR de la ONU *
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Escanea o escribe la MAC..."
                value={selectedMac}
                onChange={(e) => setSelectedMac(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-sky-600 dark:text-sky-400 focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={isScanning}
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-1.5 border border-slate-700 transition shrink-0"
              >
                <QrCode className={`w-4 h-4 ${isScanning ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
                <span>{isScanning ? 'Leyendo...' : 'Escanear'}</span>
              </button>
            </div>

            {/* Quick picker from vehicle */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400">ONUs en tu camioneta:</span>
              {onusInVehicle.map(onu => (
                <button
                  key={onu.id}
                  type="button"
                  onClick={() => setSelectedMac(onu.macAddress)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition ${
                    selectedMac === onu.macAddress
                      ? 'bg-sky-600 text-white border-sky-600 font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {onu.macAddress} ({onu.brand})
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Materials Used */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              3. Descargo de Materiales Consumidos *
            </label>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold block">Metros Cable Drop</span>
                <input
                  type="number"
                  required
                  min="5"
                  value={dropMeters}
                  onChange={(e) => setDropMeters(parseInt(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center font-mono font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold block">Conectores SC/APC</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={connectors}
                  onChange={(e) => setConnectors(parseInt(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center font-mono font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold block">Tensores Drop</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={tensors}
                  onChange={(e) => setTensors(parseInt(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center font-mono font-bold text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Step 4: Photo & Notes */}
          <div className="space-y-1.5">
            <label className="block text-slate-700 dark:text-slate-300 font-bold">
              4. Observaciones & Evidencia Fotográfica
            </label>
            <input
              type="text"
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              placeholder="Notas técnicas (potencia óptica, router, etc.)"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 text-sm transition transform active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Aprovisionando en Wispro y descontando stock...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Finalizar Instalación & Aprovisionar en Wispro</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
