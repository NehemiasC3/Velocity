import React, { useState, useEffect } from 'react';
import { Bell, MapPin, AlertCircle, Calendar, Check, Save, Send, Sparkles, ShieldCheck } from 'lucide-react';
import { playAlertSound } from '../utils/notifications';

interface PreferencesState {
  zones: string[];
  priorities: string[];
  events: string[];
}

const DEFAULT_PREFS: PreferencesState = {
  zones: ['Todas'],
  priorities: ['Alta', 'Normal'],
  events: ['orders', 'issues', 'audits']
};

const ZONES_LIST = [
  { id: 'Todas', label: 'Todas las Zonas', desc: 'Recibir alertas de toda la red de cobertura' },
  { id: 'Platanilla', label: 'Platanilla', desc: 'Sector principal y troncal de fibra' },
  { id: 'Torti', label: 'Torti', desc: 'Sector este y nodos de distribución' },
  { id: 'La Siesta', label: 'La Siesta', desc: 'Sector urbano y ramales de clientes' }
];

const PRIORITIES_LIST = [
  { id: 'Alta', label: 'Alta / Emergencia', desc: 'Cortes masivos, caídas de nodo y averías críticas', color: 'text-rose-600', border: 'border-rose-300' },
  { id: 'Normal', label: 'Normal / Informativa', desc: 'Órdenes rutinarias, cambios de estado y avisos estándar', color: 'text-blue-600', border: 'border-blue-300' }
];

const EVENTS_LIST = [
  { id: 'orders', label: 'Nuevas Órdenes', desc: 'Instalaciones pendientes y activaciones de servicio' },
  { id: 'issues', label: 'Reportes de Averías', desc: 'Tickets de soporte, pérdida de potencia y fallas de enlace' },
  { id: 'audits', label: 'Auditorías y Cambios', desc: 'Modificaciones de inventario y configuración de equipos' }
];

export const NotificationPreferences: React.FC = () => {
  const [prefs, setPrefs] = useState<PreferencesState>(() => {
    try {
      const saved = localStorage.getItem('velocity_notification_prefs');
      return saved ? JSON.parse(saved) : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testZone, setTestZone] = useState('Platanilla');
  const [testPriority, setTestPriority] = useState('Alta');
  const [testEvent, setTestEvent] = useState('issues');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Sincronizar preferencias con el backend al montar
  useEffect(() => {
    async function syncWithBackend() {
      if (!('serviceWorker' in navigator)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const res = await fetch(`/api/v1/notifications/preferences?endpoint=${encodeURIComponent(sub.endpoint)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
              setPrefs(data.preferences);
              localStorage.setItem('velocity_notification_prefs', JSON.stringify(data.preferences));
            }
          }
        }
      } catch (err) {
        console.warn('[NotificationPreferences] Sincronización inicial omitida:', err);
      }
    }
    syncWithBackend();
  }, []);

  const toggleZone = (zoneId: string) => {
    setPrefs((prev) => {
      let newZones: string[];
      if (zoneId === 'Todas') {
        newZones = prev.zones.includes('Todas') ? [] : ['Todas'];
      } else {
        const withoutAll = prev.zones.filter((z) => z !== 'Todas');
        if (withoutAll.includes(zoneId)) {
          newZones = withoutAll.filter((z) => z !== zoneId);
        } else {
          newZones = [...withoutAll, zoneId];
        }
        if (newZones.length === 0) newZones = ['Todas'];
      }
      return { ...prev, zones: newZones };
    });
  };

  const togglePriority = (priorityId: string) => {
    setPrefs((prev) => {
      const exists = prev.priorities.includes(priorityId);
      const newPriorities = exists
        ? prev.priorities.filter((p) => p !== priorityId)
        : [...prev.priorities, priorityId];
      return { ...prev, priorities: newPriorities.length ? newPriorities : [priorityId] };
    });
  };

  const toggleEvent = (eventId: string) => {
    setPrefs((prev) => {
      const exists = prev.events.includes(eventId);
      const newEvents = exists
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId];
      return { ...prev, events: newEvents.length ? newEvents : [eventId] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem('velocity_notification_prefs', JSON.stringify(prefs));

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          const res = await fetch('/api/v1/notifications/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              preferences: prefs
            })
          });

          if (!res.ok) {
            throw new Error('No se pudo guardar en el servidor');
          }
        }
      }

      setSaveSuccess(true);
      playAlertSound();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('[NotificationPreferences] Error al guardar:', err.message);
      alert('Se guardó localmente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTestStatus('Enviando alerta simulada...');
    playAlertSound();
    try {
      const res = await fetch('/api/v1/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone: testZone,
          priority: testPriority,
          event: testEvent
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus(`✅ Alerta enviada: ${data.sent} entregadas.`);
      } else {
        setTestStatus('⚠️ Error al emitir alerta');
      }
    } catch (e: any) {
      setTestStatus(`❌ Fallo: ${e.message}`);
    }
    setTimeout(() => setTestStatus(null), 5000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Bell className="w-4 h-4" />
            <span>Configuración de Alertas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Preferencias de Notificaciones Push
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Personaliza qué alertas y zonas de trabajo deseas recibir en tu dispositivo móvil o PC.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
        >
          {saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>¡Guardado con Éxito!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Preferencias'}</span>
            </>
          )}
        </button>
      </div>

      {/* Grid de Configuración */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* 1. ZONAS DE TRABAJO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Zonas de Cobertura</h3>
              <p className="text-xs text-slate-400">Filtrar por sector</p>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {ZONES_LIST.map((zone) => {
              const isSelected = prefs.zones.includes(zone.id);
              return (
                <div
                  key={zone.id}
                  onClick={() => toggleZone(zone.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <span className={`font-bold text-xs ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                      {zone.label}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{zone.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition mt-0.5 ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. NIVELES DE PRIORIDAD */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertCircle className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Nivel de Prioridad</h3>
              <p className="text-xs text-slate-400">Urgencia del reporte</p>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {PRIORITIES_LIST.map((p) => {
              const isSelected = prefs.priorities.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => togglePriority(p.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? `bg-slate-50 ${p.border || 'border-blue-300'} shadow-xs`
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <span className={`font-bold text-xs ${isSelected ? p.color : 'text-slate-700'}`}>
                      {p.label}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition mt-0.5 ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. TIPO DE EVENTO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Tipos de Eventos</h3>
              <p className="text-xs text-slate-400">Categoría de actividad</p>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            {EVENTS_LIST.map((evt) => {
              const isSelected = prefs.events.includes(evt.id);
              return (
                <div
                  key={evt.id}
                  onClick={() => toggleEvent(evt.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-300 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div>
                    <span className={`font-bold text-xs ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>
                      {evt.label}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{evt.desc}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition mt-0.5 ${
                      isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Simulador y Banco de Pruebas de Filtros */}
      <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulador de Emisión Push Filtrada</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Prueba en tiempo real si tus filtros reciben o descartan una alerta
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura los metadatos de la alerta a emitir y comprueba el filtrado inteligente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={testZone}
              onChange={(e) => setTestZone(e.target.value)}
              className="bg-white border border-slate-300 text-xs text-slate-700 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="Platanilla">Zona: Platanilla</option>
              <option value="Torti">Zona: Torti</option>
              <option value="La Siesta">Zona: La Siesta</option>
            </select>

            <select
              value={testPriority}
              onChange={(e) => setTestPriority(e.target.value)}
              className="bg-white border border-slate-300 text-xs text-slate-700 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="Alta">Prioridad: Alta</option>
              <option value="Normal">Prioridad: Normal</option>
            </select>

            <select
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              className="bg-white border border-slate-300 text-xs text-slate-700 rounded-xl px-3 py-2 font-medium focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="issues">Evento: Averías</option>
              <option value="orders">Evento: Órdenes</option>
              <option value="audits">Evento: Auditorías</option>
            </select>

            <button
              onClick={handleSendTest}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Emitir Alerta</span>
            </button>
          </div>
        </div>

        {testStatus && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{testStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
};
