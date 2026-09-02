import React from 'react';
import { UserSession } from '../types/auth';
import { Server, Search, LogOut, ShieldCheck, Activity } from 'lucide-react';

interface NavigationProps {
  activeTab: 'inventory' | 'overview' | 'settings';
  onTabChange: (tab: 'inventory' | 'overview' | 'settings') => void;
  session: UserSession | null;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  session,
  onLogout,
  onOpenLogin
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur sticky top-0 z-40">
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
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onTabChange('inventory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'inventory'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Inventario Instantáneo</span>
            </button>

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
