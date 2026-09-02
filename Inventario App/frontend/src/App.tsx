import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { DashboardHome } from './components/DashboardHome';
import { CatalogIngestionModule } from './components/CatalogIngestionModule';
import { WarehousesModule } from './components/WarehousesModule';
import { TransfersModule } from './components/TransfersModule';
import { ForensicAuditModule } from './components/ForensicAuditModule';
import { PersonnelMetricsModule } from './components/PersonnelMetricsModule';
import { TechnicianMobileApp } from './components/TechnicianMobileApp';
import { WisproModule } from './components/WisproModule';
import { InventorySearch } from './components/InventorySearch'; // Importamos el nuevo componente
import { RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react';
import { api } from './services/api';

const AppContent: React.FC = () => {
  const { currentUser, loading, error, refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [auditInitialQuery, setAuditInitialQuery] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Iniciando Sistema de Inventario ISP...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
          <h2 className="text-xl font-bold">Error de Conexión</h2>
          <p className="text-sm text-slate-400 max-w-xs">
            No se pudo conectar con el servidor. Por favor, comprueba que el backend esté funcionando y vuelve a intentarlo.
          </p>
          <p className="text-xs text-slate-500 bg-slate-800 rounded px-2 py-1 font-mono">
            {error.message}
          </p>
          <button
            onClick={refreshUsers}
            className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      
      {/* Top Header & Navbar */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onRefreshAll={handleRefreshAll} 
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div key={refreshKey}>
          {activeTab === 'dashboard' && <DashboardHome onNavigateTab={handleNavigateTab} />}
          
          {/* Podemos añadir una nueva pestaña o integrarlo en el dashboard */}
          {activeTab === 'inventory-search' && <InventorySearch />}

          {activeTab === 'catalog' && <CatalogIngestionModule />}
          {activeTab === 'warehouses' && <WarehousesModule />}
          {activeTab === 'transfers' && <TransfersModule />}
          {activeTab === 'audit' && <ForensicAuditModule initialSearch={auditInitialQuery} />}
          {activeTab === 'personnel' && <PersonnelMetricsModule />}
          {activeTab === 'mobile' && <TechnicianMobileApp />}
          {activeTab === 'wispro' && <WisproModule />}
        </div>
      </main>

      {/* Footer with System Actions */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Sistema de Inventario ISP Hub-and-Spoke • Conectado a <strong>Wispro Cloud API</strong>
          </p>

          <div className="flex items-center gap-4">
            <span className="text-[11px] text-slate-400">
              Usuario Activo: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.name}</strong> ({currentUser?.role})
            </span>
            
            {currentUser?.role === 'ADMIN_BODEGA' && (
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
