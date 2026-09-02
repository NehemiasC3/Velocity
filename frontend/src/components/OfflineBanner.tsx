import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-600/90 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-center gap-2 sticky top-0 z-50 backdrop-blur border-b border-amber-500 animate-slideDown">
      <WifiOff className="w-4 h-4 animate-pulse flex-shrink-0" />
      <span>⚠️ Sin conexión a Internet. Operando en modo Offline con datos cacheados en campo.</span>
      <span className="hidden sm:inline bg-amber-800/80 px-2 py-0.5 rounded text-[10px] text-amber-200 border border-amber-400/40 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        PWA Cache Activo
      </span>
    </div>
  );
};
