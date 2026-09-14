import React, { useState } from 'react';
import * as Sentry from '@sentry/react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { InventorySearch } from './components/InventorySearch';
import { SystemOverview } from './components/SystemOverview';
import { AuthModal } from './components/AuthModal';
import { NotificationPrompt } from './components/NotificationPrompt';
import { OfflineBanner } from './components/OfflineBanner';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar, WisproTab } from './components/Sidebar';
import { ClientsPage } from './components/pages/ClientsPage';
import { ContractsPage } from './components/pages/ContractsPage';
import { PlansPage } from './components/pages/PlansPage';
import { NetworkPage } from './components/pages/NetworkPage';
import { WorkOrdersPage } from './components/pages/WorkOrdersPage';
import { BillingPage } from './components/pages/BillingPage';
import { SettingsPage } from './components/pages/SettingsPage';

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
  const [activeTab, setActiveTab] = useState<WisproTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const { session, loading: authLoading, error: authError, login, logout } = useAuth();

  const handleLoginSubmit = async (email: string, pass: string): Promise<boolean> => {
    const success = await login(email, pass);
    if (success) {
      setIsAuthModalOpen(false);
    }
    return success;
  };

  const handleNavigate = (tab: WisproTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-row antialiased selection:bg-blue-500 selection:text-white font-sans">
      {/* 1. Alerta de Estado Offline */}
      <OfflineBanner />

      {/* 2. Banner de Instalación PWA */}
      <PwaInstallPrompt />

      {/* 3. Toast de Auto-Actualización */}
      <UpdatePrompt />

      {/* 4. Banner de Notificaciones Push */}
      <NotificationPrompt userId={session?.userId} role={session?.role} />

      {/* 5. Sidebar Lateral BSS/OSS (9 Módulos Exactos) */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        currentUser={session ? { name: session.name || 'Usuario', email: session.email, role: session.role || 'SUPERVISOR' } : null}
        onLogout={logout}
      />

      {/* 6. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full">
              Velocity ISP Suite v2.1
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!session && (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">
          <ErrorBoundary viewName={activeTab}>
            {activeTab === 'dashboard' && <SystemOverview />}
            {activeTab === 'clients' && <ClientsPage />}
            {activeTab === 'contracts' && <ContractsPage />}
            {activeTab === 'plans' && <PlansPage />}
            {activeTab === 'network' && <NetworkPage />}
            {activeTab === 'inventory' && <InventorySearch />}
            {activeTab === 'work-orders' && <WorkOrdersPage />}
            {activeTab === 'billing' && <BillingPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>

        <footer className="border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 bg-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-medium text-slate-600">Velocity ISP Suite &bull; PWA &bull; Integración Wispro Cloud</p>
            <p className="text-slate-400">Arquitectura BSS/OSS Resiliente &bull; sub-20ms</p>
          </div>
        </footer>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onLogin={handleLoginSubmit}
        loading={authLoading}
        error={authError}
      />
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
