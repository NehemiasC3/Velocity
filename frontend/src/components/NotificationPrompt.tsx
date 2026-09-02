import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Bell, BellRing, BellOff, Volume2, X } from 'lucide-react';

interface NotificationPromptProps {
  userId?: string;
  role?: string;
}

export const NotificationPrompt: React.FC<NotificationPromptProps> = ({ userId, role }) => {
  const {
    supported,
    permission,
    isSubscribed,
    loading,
    enableNotifications,
    sendTestAlert
  } = usePushNotifications(userId, role);

  const [dismissed, setDismissed] = useState(false);
  const [activeToast, setActiveToast] = useState<{ title: string; body: string } | null>(null);

  // Escuchar eventos de alertas en primer plano
  useEffect(() => {
    const handleToast = (e: any) => {
      if (e.detail) {
        setActiveToast({ title: e.detail.title, body: e.detail.body });
        setTimeout(() => setActiveToast(null), 6000);
      }
    };

    window.addEventListener('velocity-toast-alert', handleToast);
    return () => window.removeEventListener('velocity-toast-alert', handleToast);
  }, []);

  if (!supported) return null;

  return (
    <>
      {/* Toast Emergente en Primer Plano (si la pestaña está activa) */}
      {activeToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 border-2 border-indigo-500 rounded-2xl p-4 shadow-2xl shadow-indigo-500/20 animate-slideDown flex items-start gap-3 backdrop-blur-lg">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl flex-shrink-0">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-white">{activeToast.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5">{activeToast.body}</p>
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-500 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner Flotante para Solicitar Permisos si están en Default */}
      {permission === 'default' && !dismissed && (
        <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900/95 to-slate-950 border-b border-indigo-500/30 px-4 py-3 text-white text-xs shadow-lg backdrop-blur">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
                <BellRing className="w-4 h-4 animate-pulse" />
              </span>
              <div>
                <span className="font-semibold text-slate-100">
                  ¿Deseas recibir alertas cuando la pestaña esté minimizada o cerrada?
                </span>
                <p className="text-[11px] text-slate-400">
                  Recibe avisos sonoros instantáneos (estilo WhatsApp) de nuevas órdenes, fallos y reportes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => enableNotifications()}
                disabled={loading}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Activar Alertas</span>
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white transition"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controles Rápidos en Cabecera / Barra Inferior */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        {permission === 'granted' && isSubscribed && (
          <button
            onClick={sendTestAlert}
            title="Probar sonido y notificación en segundo plano"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/40 shadow-xl backdrop-blur transition hover:scale-105"
          >
            <Volume2 className="w-4 h-4" />
            <span className="hidden sm:inline">Probar Alerta</span>
          </button>
        )}

        {permission === 'denied' && (
          <div
            title="Las notificaciones están bloqueadas en el navegador. Haz clic en el candado de la barra de URL para permitirlas."
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900/90 text-amber-400 text-xs rounded-xl border border-amber-500/30 shadow-xl backdrop-blur"
          >
            <BellOff className="w-4 h-4" />
            <span className="hidden sm:inline">Alertas Bloqueadas</span>
          </div>
        )}

        {permission !== 'granted' && permission !== 'denied' && (
          <button
            onClick={() => enableNotifications()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-xl shadow-indigo-600/30 transition hover:scale-105"
          >
            <Bell className="w-4 h-4 animate-bounce" />
            <span>Activar Alertas Push</span>
          </button>
        )}
      </div>
    </>
  );
};
