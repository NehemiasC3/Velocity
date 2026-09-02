import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Detectar si ya se está ejecutando como app instalada (Standalone PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      console.log('[PWA] Evento beforeinstallprompt capturado y listo para instalación.');
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] ¡Aplicación instalada exitosamente en el dispositivo!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] Usuario aceptó la instalación de Velocity.');
        setIsInstallable(false);
      } else {
        console.log('[PWA] Usuario rechazó la instalación.');
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('[PWA] Error durante instalación:', err);
    }
  };

  if (isInstalled || !isInstallable || dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border-b border-indigo-500/30 px-4 py-2.5 text-white text-xs shadow-xl animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg flex-shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              📱 Instalar Velocity como App Móvil / PC
              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-400/30">
                Offline Ready
              </span>
            </span>
            <p className="text-[11px] text-slate-400">
              Acceso directo rápido sin barra de navegador y consulta de inventario sin conexión en campo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md shadow-indigo-600/30 transition hover:scale-105"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white transition rounded-md"
            title="Descartar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
