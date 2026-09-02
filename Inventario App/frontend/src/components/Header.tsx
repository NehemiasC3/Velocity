import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, UserCheck, ShieldAlert, RefreshCw, Smartphone, 
  Layers, Search, Users, Wifi, AlertTriangle, Truck, Server,
  PackagePlus
} from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefreshAll: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onRefreshAll }) => {
  const { currentUser, allUsers, switchUser } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const handleWisproSync = async () => {
    try {
      setSyncing(true);
      const res = await api.syncWispro();
      setSyncToast(res.message);
      onRefreshAll();
      setTimeout(() => setSyncToast(null), 5000);
    } catch (err: any) {
      setSyncToast(`Error sincronizando: ${err.message}`);
      setTimeout(() => setSyncToast(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const navTabs = [
    { id: 'dashboard', label: 'Panel General', icon: Layers },
    { id: 'catalog', label: 'Catálogo & Altas', icon: PackagePlus, roleLimit: ['ADMIN_BODEGA'] },
    { id: 'warehouses', label: 'Bodegas & Stock', icon: Boxes },
    { id: 'transfers', label: 'Traslados', icon: Truck },
    { id: 'inventory-search', label: 'Búsqueda Rápida', icon: Search, highlight: true },
    { id: 'audit', label: 'Auditoría Forense', icon: ShieldCheck },
    { id: 'personnel', label: 'Métricas de Cuadrillas', icon: Users, roleLimit: ['ADMIN_BODEGA', 'ENCARGADO_PERSONAL'] },
    { id: 'mobile', label: 'App de Campo', icon: Smartphone, highlight: true },
    { id: 'wispro', label: 'Wispro Cloud', icon: Wifi },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-lg">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight bg-gradient-to-r from-sky-400 via-blue-200 to-indigo-300 bg-clip-text text-transparent">
                  ISP Fibra Inventory
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Hub & Spoke
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Control de Stock Central a Móvil + Wispro API</p>
            </div>
          </div>

          {/* Quick RBAC Switcher & Actions */}
          <div className="flex items-center gap-3">
            
            {/* Sync with Wispro Button */}
            <button
              onClick={handleWisproSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition"
              title="Sincronizar base de clientes y contratos con Wispro Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-sky-300' : ''}`} />
              <span className="hidden md:inline">Sync Wispro</span>
            </button>

            {/* Persona Switcher dropdown */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Simular Usuario (RBAC)</span>
                <select
                  value={currentUser?.id || ''}
                  onChange={(e) => switchUser(e.target.value)}
                  className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer pr-4"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Check role limitation if any
            if (tab.roleLimit && currentUser && !tab.roleLimit.includes(currentUser.role)) {
              return null;
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? tab.highlight 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40'
                      : 'bg-sky-600 text-white shadow-md shadow-sky-900/40'
                    : tab.highlight
                      ? 'bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-700/50'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.highlight && !isActive ? 'text-emerald-400 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {tab.highlight && (
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-400 text-slate-950 font-bold px-1.5 py-0.2 rounded-full">
                    Técnico
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="bg-sky-600 text-white text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>{syncToast}</span>
          </div>
        </div>
      )}
    </header>
  );
};
