import React, { useState } from 'react';
import { UserSession } from '../types/auth';
import { 
  Server, 
  Boxes, 
  LogOut, 
  ShieldCheck, 
  Activity, 
  Bell, 
  ChevronDown, 
  LayoutDashboard, 
  Warehouse, 
  Truck, 
  ClipboardCheck 
} from 'lucide-react';

export type MainTab = 'inventory' | 'overview' | 'settings';
export type InventorySubTab = 'dashboard' | 'warehouses' | 'transfers' | 'audits';

interface NavigationProps {
  activeTab: MainTab;
  activeSubTab?: InventorySubTab;
  onTabChange: (tab: MainTab, subTab?: InventorySubTab) => void;
  session: UserSession | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  activeSubTab = 'dashboard',
  onTabChange,
  session,
  onLogout,
  onOpenLogin
}) => {
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(activeTab === 'inventory');

  const handleParentInventoryClick = () => {
    setIsInventoryOpen(prev => !prev);
    if (activeTab !== 'inventory') {
      onTabChange('inventory', activeSubTab);
    }
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-indigo-500/25">
              V
            </div>
            <span className="font-bold text-lg text-white tracking-wide flex items-center gap-2">
              VELOCITY
              <span className="hidden sm:inline-block text-xs font-normal px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                ISP Suite v2.1
              </span>
            </span>
          </div>

          {/* Tab Navigation Buttons */}
          <nav className="hidden md:flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            
            {/* 📦 INVENTARIO CON DROPDOWN / ACORDEÓN */}
            <div className="relative">
              <button
                type="button"
                onClick={handleParentInventoryClick}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'inventory'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Inventario</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${
                    isInventoryOpen ? 'rotate-180 text-white' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Menú Desplegable de Sub-Ítems */}
              {isInventoryOpen && (
                <div className="absolute top-full left-0 mt-2 w-52 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Módulo de Inventario
                  </div>
                  
                  {/* Sub-ítem 1: Dashboard */}
                  <button
                    onClick={() => {
                      onTabChange('inventory', 'dashboard');
                      setIsInventoryOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${
                      activeTab === 'inventory' && activeSubTab === 'dashboard'
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dashboard</span>
                  </button>

                  {/* Sub-ítem 2: Bodegas */}
                  <button
                    onClick={() => {
                      onTabChange('inventory', 'warehouses');
                      setIsInventoryOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${
                      activeTab === 'inventory' && activeSubTab === 'warehouses'
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Warehouse className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Bodegas</span>
                  </button>

                  {/* Sub-ítem 3: Envíos / Traslados */}
                  <button
                    onClick={() => {
                      onTabChange('inventory', 'transfers');
                      setIsInventoryOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${
                      activeTab === 'inventory' && activeSubTab === 'transfers'
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Envíos / Traslados</span>
                  </button>

                  {/* Sub-ítem 4: Auditorías */}
                  <button
                    onClick={() => {
                      onTabChange('inventory', 'audits');
                      setIsInventoryOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition ${
                      activeTab === 'inventory' && activeSubTab === 'audits'
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Auditorías</span>
                  </button>
                </div>
              )}
            </div>

            {/* Estado del Sistema */}
            <button
              onClick={() => onTabChange('overview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Estado del Sistema</span>
            </button>

            {/* Preferencias */}
            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Preferencias de Alertas</span>
            </button>
          </nav>
        </div>

        {/* User Session & Status */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900/80 rounded-full border border-slate-800 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>API Wispro Conectada</span>
          </div>

          {session ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <div className="text-left leading-tight">
                  <p className="font-semibold text-white">{session.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{session.role}</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                title="Cerrar Sesión"
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-indigo-600/20"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Acceder</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

