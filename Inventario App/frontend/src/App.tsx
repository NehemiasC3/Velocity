import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { DashboardHome } from './components/DashboardHome';
import { InboundModule } from './components/InboundModule';
import { CatalogModule } from './components/CatalogModule';
import { WarehousesModule } from './components/WarehousesModule';
import { TransfersModule } from './components/TransfersModule';
import { RmaReturn } from './components/RmaReturn';
import { ForensicAuditModule } from './components/ForensicAuditModule';
import { PersonnelMetricsModule } from './components/PersonnelMetricsModule';
import { TechnicianMobileApp } from './components/TechnicianMobileApp';
import { WisproModule } from './components/WisproModule';
import { InventorySearch } from './components/InventorySearch';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { Login } from './components/Login';
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { api } from './services/api';

const mapTabParam = (rawTab: string | null): string => {
  if (!rawTab) return 'dashboard';
  const t = rawTab.toLowerCase().trim();
  switch (t) {
    case 'bodegas':
    case 'warehouses':
      return 'warehouses';
    case 'traslados':
    case 'transfers':
      return 'transfers';
    case 'auditorias':
    case 'audits':
    case 'audit':
      return 'audit';
    case 'catalogo':
    case 'catalog':
      return 'catalog';
    case 'ingreso':
    case 'inbound':
      return 'inbound';
    case 'rma':
    case 'devoluciones':
      return 'rma';
    case 'mobile':
    case 'tecnico':
    case 'camioneta':
      return 'mobile';
    case 'wispro':
      return 'wispro';
    case 'personnel':
    case 'metricas':
      return 'personnel';
    case 'search':
    case 'inventory-search':
      return 'inventory-search';
    case 'dashboard':
    default:
      return 'dashboard';
  }
};

const AppContent: React.FC = () => {
  const { currentUser, loading, error, refreshUsers } = useAuth();
  
  // Detectar si está incrustado en iframe
  const [isEmbedded, setIsEmbedded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('embedded') === 'true' || window.self !== window.top;
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    return mapTabParam(params.get('tab'));
  });

  const [auditInitialQuery, setAuditInitialQuery] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Redirección centralizadora: Si el usuario abre /inventory/ directamente en la ventana principal,
  // redirigir de inmediato al portal central /supervisor con la pestaña de inventario
  useEffect(() => {
    if (typeof window !== 'undefined' && window.self === window.top) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('standalone') !== 'true') {
        const requestedTab = params.get('tab') || 'dashboard';
        window.location.replace(`/supervisor?tab=inventory&subTab=${encodeURIComponent(requestedTab)}`);
      }
    }
  }, []);

  // Escuchar cambios de parámetros y mensajes postMessage desde el padre (supervisor.html)
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const embedded = params.get('embedded') === 'true' || window.self !== window.top;
      setIsEmbedded(embedded);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(mapTabParam(tab));
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_TAB') {
        const mapped = mapTabParam(event.data.tab);
        setActiveTab(mapped);
        if (event.data.param) {
          setAuditInitialQuery(event.data.param);
        }
      }
    };

    const handleTogglePalette = () => {
      setIsCommandPaletteOpen(prev => !prev);
    };

    const handleOpenPalette = () => {
      setIsCommandPaletteOpen(true);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('message', handleMessage);
    window.addEventListener('toggle-command-palette', handleTogglePalette);
    window.addEventListener('open-command-palette', handleOpenPalette);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('toggle-command-palette', handleTogglePalette);
      window.removeEventListener('open-command-palette', handleOpenPalette);
    };
  }, []);

  // Adaptar pestaña activa si el rol del usuario cambia
  useEffect(() => {
    if (currentUser && !isEmbedded) {
      if (currentUser.role === 'TECNICO' && (activeTab === 'dashboard' || activeTab === 'catalog' || activeTab === 'audit')) {
        setActiveTab('mobile');
      } else if (currentUser.role === 'BODEGUERO_SUCURSAL' && (activeTab === 'dashboard' || activeTab === 'catalog' || activeTab === 'audit')) {
        setActiveTab('warehouses');
      }
    }
  }, [currentUser?.id, currentUser?.role, isEmbedded]);

  const handleNavigateTab = (tab: string, param?: string) => {
    if (tab === 'audit' && param) {
      setAuditInitialQuery(param);
    }
    setActiveTab(tab);
  };

  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleResetDatabase = async () => {
    if (window.confirm('¿Reiniciar la base de datos a los valores de prueba iniciales del ISP?')) {
      try {
        await api.resetSystem();
        alert('Base de datos reiniciada con éxito.');
        window.location.reload();
      } catch (err: any) {
        alert(`Error al reiniciar: ${err.message}`);
      }
    }
  };

  if (loading && !isEmbedded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-sm font-medium">Iniciando Sistema de Inventario ISP...</p>
        </div>
      </div>
    );
  }

  if (error && !currentUser && !isEmbedded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-800 p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
          <h2 className="text-xl font-bold">Error de Conexión</h2>
          <p className="text-sm text-slate-600">
            No se pudo conectar con el servidor backend en el puerto 4000. Por favor, asegúrate de que el backend esté activo.
          </p>
          <p className="text-xs text-slate-700 bg-slate-200 rounded px-2 py-1 font-mono">
            {error.message}
          </p>
          <button
            onClick={refreshUsers}
            className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado y no está embebido, mostrar pantalla de Login
  if (!currentUser && !isEmbedded) {
    return <Login onLoginSuccess={() => refreshUsers()} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors ${isEmbedded ? 'p-0 bg-transparent' : ''}`}>
      
      {/* Global Command Palette (Ctrl+K / Cmd+K & Universal Search) */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={handleNavigateTab}
      />

      {/* Top Header & Navbar (Oculto en modo embebido iframe) */}
      {!isEmbedded && (
        <Header 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onRefreshAll={handleRefreshAll}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
        />
      )}

      {/* Main Content Area - Keep-Alive DOM Caching (0ms Tab Switching) */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-6">
        <div key={refreshKey} className="w-full">
          <div className={`w-full ${activeTab === 'dashboard' ? 'block' : 'hidden'}`}>
            <DashboardHome onNavigateTab={handleNavigateTab} />
          </div>
          <div className={`w-full ${activeTab === 'warehouses' ? 'block' : 'hidden'}`}>
            <WarehousesModule />
          </div>
          <div className={`w-full ${activeTab === 'catalog' ? 'block' : 'hidden'}`}>
            <CatalogModule />
          </div>
          <div className={`w-full ${activeTab === 'inbound' ? 'block' : 'hidden'}`}>
            <InboundModule />
          </div>
          <div className={`w-full ${activeTab === 'transfers' ? 'block' : 'hidden'}`}>
            <TransfersModule />
          </div>
          <div className={`w-full ${activeTab === 'rma' ? 'block' : 'hidden'}`}>
            <RmaReturn />
          </div>
          <div className={`w-full ${activeTab === 'audit' ? 'block' : 'hidden'}`}>
            <ForensicAuditModule initialSearch={auditInitialQuery} />
          </div>
          <div className={`w-full ${activeTab === 'inventory-search' ? 'block' : 'hidden'}`}>
            <InventorySearch />
          </div>
          <div className={`w-full ${activeTab === 'personnel' ? 'block' : 'hidden'}`}>
            <PersonnelMetricsModule />
          </div>
          <div className={`w-full ${activeTab === 'mobile' ? 'block' : 'hidden'}`}>
            <TechnicianMobileApp />
          </div>
          <div className={`w-full ${activeTab === 'wispro' ? 'block' : 'hidden'}`}>
            <WisproModule />
          </div>
        </div>
      </main>

      {/* Footer with System Actions (Oculto en modo embebido iframe) */}
      {!isEmbedded && (
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>
              Sistema de Inventario ISP Hub-and-Spoke • Conectado a <strong>Wispro Cloud API</strong>
            </p>

            <div className="flex items-center gap-4">
              <span className="text-[11px] text-slate-400">
                Usuario Activo: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.name}</strong> ({currentUser?.role})
              </span>
              
              {(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN_BODEGA') && (
                <button
                  onClick={handleResetDatabase}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-500 transition text-[11px]"
                  title="Reiniciar base de datos a los valores de demostración"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Demo Data</span>
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;


