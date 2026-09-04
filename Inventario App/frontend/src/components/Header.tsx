import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Boxes, UserCheck, ShieldAlert, ShieldCheck, RefreshCw, Smartphone, 
  Layers, Search, Users, Wifi, AlertTriangle, Truck, Server,
  PackagePlus, ArrowDownToLine, RotateCcw, LogOut
} from 'lucide-react';
import { api } from '../services/api';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRefreshAll: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onRefreshAll, onOpenSearch }) => {
  const { currentUser, allUsers, switchUser, logout } = useAuth();
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
    { 
      id: 'dashboard', 
      label: 'Panel General', 
      icon: Layers,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'SUPERVISOR_MESA', 'AUDITOR_INTERNO', 'ENCARGADO_PERSONAL'] 
    },
    { 
      id: 'inbound', 
      label: 'Ingreso de Mercancía', 
      icon: ArrowDownToLine, 
      highlight: true,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'BODEGUERO_PRINCIPAL', 'BODEGUERO_SUCURSAL'] 
    },
    { 
      id: 'catalog', 
      label: 'Catálogo de Materiales', 
      icon: PackagePlus, 
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'BODEGUERO_PRINCIPAL'] 
    },
    { 
      id: 'warehouses', 
      label: 'Bodegas & Stock', 
      icon: Boxes,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'BODEGUERO_PRINCIPAL', 'BODEGUERO_SUCURSAL', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'transfers', 
      label: 'Traslados', 
      icon: Truck,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'BODEGUERO_PRINCIPAL', 'BODEGUERO_SUCURSAL', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'rma', 
      label: 'Devoluciones RMA', 
      icon: RotateCcw,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'BODEGUERO_PRINCIPAL', 'BODEGUERO_SUCURSAL', 'TECNICO', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'inventory-search', 
      label: 'Búsqueda Rápida', 
      icon: Search 
    },
    { 
      id: 'audit', 
      label: 'Auditoría Forense', 
      icon: ShieldCheck,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'AUDITOR_INTERNO', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'personnel', 
      label: 'Métricas de Cuadrillas', 
      icon: Users, 
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'ENCARGADO_PERSONAL', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'mobile', 
      label: 'App de Campo', 
      icon: Smartphone, 
      highlight: true,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'TECNICO', 'SUPERVISOR_MESA'] 
    },
    { 
      id: 'wispro', 
      label: 'Wispro Cloud', 
      icon: Wifi,
      roleLimit: ['SUPERADMIN', 'ADMIN_BODEGA', 'SUPERVISOR_MESA'] 
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white text-slate-900 border-b border-slate-200 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900">
                  ISP Fibra Inventory
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {currentUser?.role || 'Hub & Spoke'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Control de Stock Central a Móvil + Wispro API</p>
            </div>
          </div>

          {/* Universal Search Command Palette Trigger */}
          <button
            onClick={() => onOpenSearch ? onOpenSearch() : window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-white border border-slate-300 hover:border-blue-500 text-slate-700 transition shadow-inner group max-w-xs w-full sm:w-auto cursor-pointer"
            title="Abrir Búsqueda Universal (Ctrl + K)"
          >
            <Search className="w-4 h-4 text-blue-600 group-hover:scale-110 transition" />
            <span className="text-xs text-slate-500 group-hover:text-slate-700 hidden md:inline truncate">
              Buscar MAC, ONU, Cliente...
            </span>
            <span className="text-xs text-slate-500 group-hover:text-slate-700 md:hidden">
              Buscar...
            </span>
            <div className="hidden lg:flex items-center gap-1 ml-auto pl-2">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-300 rounded text-slate-500 shadow-xs">
                Ctrl K
              </kbd>
            </div>
          </button>

          {/* Quick RBAC Switcher & Actions */}
          <div className="flex items-center gap-2.5">
            
            {/* Sync with Wispro Button */}
            <button
              onClick={handleWisproSync}
              disabled={syncing}
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
              title="Sincronizar base de clientes y contratos con Wispro Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Sync Wispro</span>
            </button>

            {/* Persona Switcher dropdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Usuario (RBAC)</span>
                <select
                  value={currentUser?.id || ''}
                  onChange={(e) => switchUser(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2 max-w-[140px] sm:max-w-[180px] truncate"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-white text-slate-900">
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 transition text-slate-500 cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Check role limitation if any
            if (tab.roleLimit && currentUser && !tab.roleLimit.includes(currentUser.role as any)) {
              return null;
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? tab.highlight 
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : tab.highlight
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.highlight && !isActive ? 'text-emerald-600' : ''}`} />
                <span>{tab.label}</span>
                {tab.highlight && (
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
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
        <div className="bg-blue-600 text-white text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <Wifi className="w-4 h-4 shrink-0" />
            <span>{syncToast}</span>
          </div>
        </div>
      )}
    </header>
  );
};
