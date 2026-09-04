import React, { useState } from 'react';
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

export const App: React.FC = () => {
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
        {activeTab === 'inventory' && <InventorySearch />}
        {activeTab === 'overview' && <SystemOverview />}
        {activeTab === 'settings' && <NotificationPreferences />}
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

export default App;
