import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Navigation } from './components/Navigation';
import { InventorySearch } from './components/InventorySearch';
import { SystemOverview } from './components/SystemOverview';
import { AuthModal } from './components/AuthModal';
import { NotificationPrompt } from './components/NotificationPrompt';
import { NotificationPreferences } from './components/NotificationPreferences';
import { OfflineBanner } from './components/OfflineBanner';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';

const SentryFallbackView: React.FC<{ resetError?: () => void }> = ({ resetError }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6">
    <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-100">Ocurrió un error en esta vista</h2>
      <p className="text-sm text-slate-400">
        Se ha producido una interrupción en el renderizado de la interfaz. El incidente ha sido registrado automáticamente en Sentry para su análisis.
      </p>
      <div className="pt-2">
        <button
          onClick={() => {
            if (resetError) {
              resetError();
            } else {
              window.location.reload();
            }
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/25 active:scale-95 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar</span>
        </button>
      </div>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'overview' | 'settings'>('inventory');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const { session, loading: authLoading, error: authError, login, logout } = useAuth();

  const handleLoginSubmit = async (email: string, pass: string): Promise<boolean> => {
    const success = await login(email, pass);
    if (success) {
      setIsAuthModalOpen(false);
    }
    return success;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col antialiased selection:bg-blue-500 selection:text-white font-sans">
      {/* 1. Alerta de Estado Offline */}
      <OfflineBanner />

      {/* 2. Banner de Instalación PWA (Móvil / PC) */}
      <PwaInstallPrompt />

      {/* 3. Toast de Auto-Actualización de la PWA (Nueva versión disponible) */}
      <UpdatePrompt />

      {/* 4. Banner de Notificaciones Push / Toast */}
      <NotificationPrompt userId={session?.userId} role={session?.role} />

      {/* 5. Top Navbar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        session={session}
        onLogout={logout}
        onOpenLogin={() => setIsAuthModalOpen(true)}
      />

      {/* 6. Main View Area */}
      <main className="flex-1 pb-10">
        <ErrorBoundary viewName={activeTab}>
          {activeTab === 'inventory' && <InventorySearch />}
          {activeTab === 'overview' && <SystemOverview />}
          {activeTab === 'settings' && <NotificationPreferences />}
        </ErrorBoundary>
      </main>

      {/* 7. Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onLogin={handleLoginSubmit}
        loading={authLoading}
        error={authError}
      />

      {/* 8. Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-600">Velocity ISP Suite &bull; PWA &bull; Integración Wispro Cloud</p>
          <p className="text-slate-400">Wispro Cloud REST Gateway &bull; Motor de Búsqueda Instantánea</p>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary viewName="Velocity Portal">
      <Sentry.ErrorBoundary fallback={({ resetError }) => <SentryFallbackView resetError={resetError} />}>
        <AppContent />
      </Sentry.ErrorBoundary>
    </ErrorBoundary>
  );
};

export default App;
