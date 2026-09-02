import React, { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log(`[Velocity PWA] Service Worker registrado en: ${swUrl}`);
      // Comprobar actualizaciones automáticamente cada 60 minutos
      if (r) {
        setInterval(() => {
          r.update().catch((err) => console.warn('[Velocity PWA] Error comprobando actualización:', err));
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[Velocity PWA] Error de registro SW:', error);
    }
  });

  // Comprobar actualizaciones cuando el usuario vuelve a enfocar la pestaña
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update().catch(() => {});
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (!needRefresh) return null;

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="fixed bottom-6 left-6 z-50 max-w-md w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/80 rounded-2xl p-4 shadow-2xl shadow-indigo-600/30 backdrop-blur-xl animate-slideUp text-white"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl flex-shrink-0 mt-0.5 animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white tracking-tight">
              ¡Nueva versión disponible de Velocity!
            </h4>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Se ha desplegado una actualización con mejoras de rendimiento y funciones. Actualiza para aplicar los cambios al instante.
          </p>

          <div className="flex items-center gap-2.5 mt-3.5">
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition hover:scale-105"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              <span>Actualizar Ahora</span>
            </button>

            <button
              onClick={() => setNeedRefresh(false)}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-800/60 transition"
            >
              Más tarde
            </button>
          </div>
        </div>

        <button
          onClick={() => setNeedRefresh(false)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
          title="Cerrar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
