import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Wrench,
  Settings,
  Warehouse,
  Cpu,
  Truck,
  RotateCcw,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Server,
  LogOut,
  ShieldCheck,
  BarChart2,
} from 'lucide-react';

export type WisproTab =
  | 'dashboard'
  | 'inventory'
  | 'work-orders'
  | 'personnel'
  | 'settings';

export type InventorySubModule =
  | 'stock'
  | 'serials'
  | 'vehicles'
  | 'rma'
  | 'transfers';

interface SidebarProps {
  activeTab: WisproTab | string;
  activeSubModule?: InventorySubModule | string;
  onNavigate: (tab: WisproTab, subModule?: InventorySubModule) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUser?: {
    name: string;
    email?: string;
    role: string;
  } | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  activeSubModule = 'stock',
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
  currentUser,
  onLogout
}) => {
  const [isInventoryExpanded, setIsInventoryExpanded] = useState<boolean>(true);
  const [apiHealth, setApiHealth] = useState<'online' | 'checking' | 'offline'>('checking');

  useEffect(() => {
    let isMounted = true;
    const checkApi = async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' }).catch(() => null);
        if (isMounted) {
          if (res && res.ok) {
            setApiHealth('online');
          } else {
            const localCheck = await fetch('http://localhost:4000/health').catch(() => null);
            setApiHealth(localCheck && localCheck.ok ? 'online' : 'offline');
          }
        }
      } catch {
        if (isMounted) setApiHealth('offline');
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    {
      id: 'dashboard' as WisproTab,
      label: 'Panel de Control',
      icon: LayoutDashboard,
    },
    {
      id: 'inventory' as WisproTab,
      label: 'Inventario',
      icon: Boxes,
      hasSubmenu: true,
      submodules: [
        {
          id: 'stock' as InventorySubModule,
          label: 'Bodegas & Stock',
          icon: Warehouse,
          desc: 'Bodegas Hub y Sucursales'
        },
        {
          id: 'serials' as InventorySubModule,
          label: 'Seriales / MACs',
          icon: Cpu,
          desc: 'Trazabilidad ONT / Routers'
        },
        {
          id: 'vehicles' as InventorySubModule,
          label: 'App Técnico',
          icon: Truck,
          desc: 'Stock en Vehículo Técnico'
        },
        {
          id: 'rma' as InventorySubModule,
          label: 'RMA / Devoluciones',
          icon: RotateCcw,
          desc: 'Garantías y Devoluciones'
        },
        {
          id: 'transfers' as InventorySubModule,
          label: 'Traslados',
          icon: ArrowLeftRight,
          desc: 'Despachos y Cadena de Custodia'
        }
      ]
    },
    {
      id: 'work-orders' as WisproTab,
      label: 'Mesa de Órdenes',
      icon: Wrench,
    },
    {
      id: 'personnel' as WisproTab,
      label: 'Métricas de Cuadrillas',
      icon: BarChart2,
    },
    {
      id: 'settings' as WisproTab,
      label: 'Ajustes',
      icon: Settings,
    }
  ];

  return (
    <aside
      className={`bg-slate-900 text-slate-200 flex flex-col h-screen border-r border-slate-800 transition-all duration-300 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-white text-xl tracking-wider shadow-lg shadow-blue-500/20 shrink-0 hover:opacity-90 transition"
            title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            V
          </button>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm tracking-wider text-white flex items-center gap-2">
                VELOCITY
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  v2.1
                </span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium truncate">
                Sistema de Inventario
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        {navItems.map((item) => {
          const isItemActive = activeTab === item.id;
          const Icon = item.icon;

          if (item.hasSubmenu) {
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (isCollapsed && onToggleCollapse) {
                      onToggleCollapse();
                    }
                    setIsInventoryExpanded(!isInventoryExpanded);
                    onNavigate('inventory', 'stock');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isItemActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={item.label}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${isItemActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && (
                      <span className="truncate tracking-wide">{item.label}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${apiHealth === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                      {isInventoryExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  )}
                </button>

                {!isCollapsed && isInventoryExpanded && item.submodules && (
                  <div className="ml-4 pl-3 border-l border-slate-800/80 space-y-1 py-1">
                    {item.submodules.map((sub) => {
                      const isSubActive = isItemActive && activeSubModule === sub.id;
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onNavigate('inventory', sub.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                            isSubActive
                              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                          }`}
                          title={sub.desc}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isItemActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-colors ${isItemActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
              {!isCollapsed && <span className="truncate tracking-wide">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer: API Health + User */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/20">
        {!isCollapsed ? (
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-200">Inventory API</span>
                <span className="text-[10px] text-slate-400">
                  {apiHealth === 'online' ? 'En línea' : apiHealth === 'checking' ? 'Verificando...' : 'Sin conexión'}
                </span>
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                apiHealth === 'online'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : apiHealth === 'checking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
          </div>
        ) : (
          <div className="flex justify-center" title="Inventory API">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                apiHealth === 'online' ? 'bg-emerald-400' : 'bg-rose-500'
              }`}
            />
          </div>
        )}

        {currentUser && !isCollapsed && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</span>
                <span className="text-[10px] text-slate-400 truncate capitalize">{currentUser.role}</span>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
