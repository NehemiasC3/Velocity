import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Users, Wifi, Camera, Tv2, Radio, Search, ChevronDown, ChevronRight,
  RefreshCw, Download, X, MapPin, FileText, Clock, Package,
  CheckCircle2, AlertCircle, Loader2, Monitor, Filter,
  ExternalLink, Calendar, User, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { ClientEquipmentView, InstalledEquipmentItem } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ONU_GPON:             { label: 'ONU GPON',   icon: Wifi,    color: 'text-sky-700',    bg: 'bg-sky-50',     border: 'border-sky-200' },
  ONU_EPON:             { label: 'ONU EPON',   icon: Wifi,    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  ONU_ONT:              { label: 'ONT',         icon: Wifi,    color: 'text-sky-700',    bg: 'bg-sky-50',     border: 'border-sky-200' },
  ROUTER:               { label: 'Router',      icon: Monitor, color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  ROUTER_WIFI:          { label: 'Router WiFi', icon: Monitor, color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  TV_BOX_OTT:           { label: 'TV Box',      icon: Tv2,     color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  CAMARA_SEGURIDAD_IOT: { label: 'Camara',      icon: Camera,  color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REPETIDOR_MESH:       { label: 'Repetidor',   icon: Radio,   color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  OLT:                  { label: 'OLT',         icon: Monitor, color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200' },
  SWITCH:               { label: 'Switch',      icon: Monitor, color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
};

function getCategoryConfig(cat?: string) {
  if (!cat) return { label: 'Equipo', icon: Package, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
  return CATEGORY_CONFIG[cat] || { label: cat, icon: Package, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Equipment Chip ───────────────────────────────────────────────────────────
const EquipmentChip: React.FC<{ item: InstalledEquipmentItem }> = ({ item }) => {
  const cfg = getCategoryConfig(item.category);
  const Icon = cfg.icon;
  return (
    <span
      title={`${item.productName || item.category} - S/N: ${item.serialNumber}`}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}
    >
      <Icon className="w-3 h-3" />
      <span>{cfg.label}</span>
    </span>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
const ClientDetailModal: React.FC<{
  client: ClientEquipmentView;
  onClose: () => void;
}> = ({ client, onClose }) => {
  const statusColors: Record<string, string> = {
    ACTIVO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    PENDIENTE_INSTALACION: 'bg-amber-100 text-amber-800 border-amber-300',
    SUSPENDIDO: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 font-mono mb-0.5">{client.contractId}</p>
              <h2 className="text-xl font-bold truncate">{client.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[client.status] || 'bg-slate-200 text-slate-700 border-slate-300'}`}>
                  {client.status.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {client.nodeName}
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> {client.planName}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition text-slate-300 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {client.address}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Equipos', value: client.installedEquipment.length, color: 'text-sky-700', bg: 'bg-sky-50' },
              { label: 'ONUs', value: client.equipmentSummary?.ONU_GPON ?? 0, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Camaras', value: client.equipmentSummary?.CAMARA_SEGURIDAD_IOT ?? 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'TV Box', value: client.equipmentSummary?.TV_BOX_OTT ?? 0, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map((k) => (
              <div key={k.label} className={`${k.bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Installed Equipment */}
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-600" /> Equipos Instalados
            </h3>
            {client.installedEquipment.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Sin equipos registrados en inventario.</p>
            ) : (
              <div className="space-y-2">
                {client.installedEquipment.map((eq) => {
                  const cfg = getCategoryConfig(eq.category);
                  const Icon = cfg.icon;
                  return (
                    <div key={eq.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${cfg.color}`}>{eq.productName || cfg.label}</p>
                        <p className="text-xs text-slate-500">{eq.brand} {eq.model}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                          {eq.serialNumber && (
                            <span className="text-[11px] font-mono text-slate-600">S/N: {eq.serialNumber}</span>
                          )}
                          {eq.macAddress && (
                            <span className="text-[11px] font-mono text-slate-600">MAC: {eq.macAddress}</span>
                          )}
                          {eq.installedDate && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(eq.installedDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                        Activo
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Ticket Timeline */}
          {client.ticketHistory && client.ticketHistory.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Historial de Tickets
              </h3>
              <div className="relative pl-4 border-l-2 border-slate-200 space-y-3">
                {client.ticketHistory.map((tk, i) => (
                  <div key={tk.id || i} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-100 border-2 border-indigo-400" />
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{tk.ticketNumber}</p>
                          <p className="text-[11px] text-slate-500">{tk.type?.replace(/_/g, ' ')}</p>
                        </div>
                        <span className="text-[10px] text-slate-400">{formatDate(tk.createdAt)}</span>
                      </div>
                      {tk.technicianName && (
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> {tk.technicianName}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ONU MAC */}
          {client.currentOnuMac && (
            <section className="bg-sky-50 border border-sky-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-sky-700 mb-1 flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5" /> ONU MAC Activa (Wispro)
              </p>
              <p className="font-mono text-sm font-bold text-sky-900">{client.currentOnuMac}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Module ──────────────────────────────────────────────────────────────
export const ClientEquipmentModule: React.FC = () => {
  const [clients, setClients] = useState<ClientEquipmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedClient, setSelectedClient] = useState<ClientEquipmentView | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getClientEquipmentView();
      setClients(res.clients || []);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos de clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = useMemo(() => {
    const withCamera = clients.filter(c => (c.equipmentSummary?.CAMARA_SEGURIDAD_IOT ?? 0) > 0).length;
    const withTvBox  = clients.filter(c => (c.equipmentSummary?.TV_BOX_OTT ?? 0) > 0).length;
    const withRep    = clients.filter(c => (c.equipmentSummary?.REPETIDOR_MESH ?? 0) > 0).length;
    const withEquip  = clients.filter(c => c.installedEquipment.length > 0).length;
    return { withCamera, withTvBox, withRep, withEquip };
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => {
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.contractId.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.nodeName.toLowerCase().includes(q) ||
        c.installedEquipment.some(eq =>
          eq.serialNumber?.toLowerCase().includes(q) ||
          eq.macAddress?.toLowerCase().includes(q) ||
          eq.productName?.toLowerCase().includes(q)
        );
      const matchCategory = categoryFilter === 'ALL' || c.installedEquipment.some(eq => eq.category === categoryFilter);
      const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [clients, search, categoryFilter, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Contrato', 'Cliente', 'Direccion', 'Nodo', 'Plan', 'Estado', 'ONU MAC', 'Tipo Equipo', 'Producto', 'Serial', 'MAC Equipo', 'Fecha Instalacion'],
    ];
    clients.forEach((c) => {
      if (c.installedEquipment.length === 0) {
        rows.push([c.contractId, c.name, c.address, c.nodeName, c.planName, c.status, c.currentOnuMac || '', '', '', '', '', '']);
      } else {
        c.installedEquipment.forEach((eq) => {
          rows.push([c.contractId, c.name, c.address, c.nodeName, c.planName, c.status, c.currentOnuMac || '',
            eq.category || '', eq.productName || '', eq.serialNumber || '', eq.macAddress || '',
            eq.installedDate ? formatDate(eq.installedDate) : '']);
        });
      }
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equipos-por-cliente-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVO: 'bg-emerald-100 text-emerald-800',
      PENDIENTE_INSTALACION: 'bg-amber-100 text-amber-800',
      SUSPENDIDO: 'bg-rose-100 text-rose-800',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-indigo-900/60 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Vista 360 de Clientes
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">Equipos por Cliente</h2>
            <p className="text-xs text-slate-300">
              Todos los equipos instalados por contrato - ONU, camaras Ezviz, TV Box, repetidores y mas.
              Cruce en tiempo real entre inventario y contratos Wispro.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl transition border border-white/20">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <button onClick={loadData} disabled={loading} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-lg">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Clientes', value: clients.length,      icon: Users,   color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          { label: 'Con Equipos',    value: totals.withEquip,    icon: Package, color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200' },
          { label: 'Con Camaras',    value: totals.withCamera,   icon: Camera,  color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
          { label: 'Con TV Box',     value: totals.withTvBox,    icon: Tv2,     color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-2xl p-4 flex items-center gap-4 shadow-sm`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg} border ${kpi.border}`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-extrabold ${kpi.color}`}>
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : kpi.value}
                </p>
                <p className="text-xs text-slate-500">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, contrato, serial, MAC..."
            className="w-full pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-slate-50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
            <option value="ALL">Todos los equipos</option>
            <option value="ONU_GPON">ONU GPON</option>
            <option value="ONU_EPON">ONU EPON</option>
            <option value="TV_BOX_OTT">TV Box OTT</option>
            <option value="CAMARA_SEGURIDAD_IOT">Camara Ezviz</option>
            <option value="REPETIDOR_MESH">Repetidor Mesh</option>
            <option value="ROUTER_WIFI">Router WiFi</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40">
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVO">Activo</option>
            <option value="PENDIENTE_INSTALACION">Pendiente Instalacion</option>
            <option value="SUSPENDIDO">Suspendido</option>
          </select>
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">{filtered.length} de {clients.length}</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={loadData} className="ml-auto text-xs underline">Reintentar</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Cargando equipos de clientes...</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Cliente / Contrato</th>
                  <th className="py-3 px-4 hidden md:table-cell">Nodo / Plan</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Direccion</th>
                  <th className="py-3 px-4">Equipos</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="text-sm">No se encontraron clientes con esos filtros.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((client) => {
                  const isExpanded = expandedIds.has(client.id);
                  return (
                    <React.Fragment key={client.id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition cursor-pointer"
                          onClick={() => toggleExpand(client.id)}>
                        <td className="py-3 px-4 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{client.name}</p>
                          <p className="font-mono text-[11px] text-sky-600 mt-0.5">{client.contractId}</p>
                          {client.currentOnuMac && <p className="font-mono text-[10px] text-slate-400 mt-0.5">{client.currentOnuMac}</p>}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <p className="font-medium text-slate-700">{client.nodeName}</p>
                          <p className="text-[11px] text-slate-400">{client.planName}</p>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell max-w-[200px]">
                          <p className="text-slate-600 truncate">{client.address}</p>
                        </td>
                        <td className="py-3 px-4">
                          {client.installedEquipment.length === 0 ? (
                            <span className="text-slate-400 italic text-[11px]">Sin equipos</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {client.installedEquipment.map((eq) => <EquipmentChip key={eq.id} item={eq} />)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(client.status)}`}>
                            {client.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/80 border-b border-slate-200 px-6 py-4">
                            <div className="space-y-4">
                              {client.installedEquipment.length > 0 ? (
                                <div>
                                  <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-sky-600" /> Equipos Instalados
                                  </p>
                                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-100 text-slate-500 font-semibold">
                                        <tr>
                                          <th className="py-2 px-3 text-left">Tipo</th>
                                          <th className="py-2 px-3 text-left">Producto</th>
                                          <th className="py-2 px-3 text-left">Serial</th>
                                          <th className="py-2 px-3 text-left">MAC</th>
                                          <th className="py-2 px-3 text-left">Fecha Inst.</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {client.installedEquipment.map((eq) => {
                                          const cfg = getCategoryConfig(eq.category);
                                          const Icon = cfg.icon;
                                          return (
                                            <tr key={eq.id} className="hover:bg-slate-50 transition">
                                              <td className="py-2 px-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                                  <Icon className="w-3 h-3" /> {cfg.label}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 font-medium text-slate-800">
                                                {eq.productName || '-'}
                                                {eq.brand && <span className="text-slate-400 ml-1">({eq.brand})</span>}
                                              </td>
                                              <td className="py-2 px-3 font-mono text-slate-700">{eq.serialNumber || '-'}</td>
                                              <td className="py-2 px-3 font-mono text-sky-700 font-bold">{eq.macAddress || '-'}</td>
                                              <td className="py-2 px-3 text-slate-500">{formatDate(eq.installedDate)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">Sin equipos con serial registrados en inventario.</p>
                              )}

                              {client.ticketHistory && client.ticketHistory.length > 0 && (
                                <div>
                                  <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-indigo-600" /> Tickets ({client.ticketHistory.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {client.ticketHistory.map((tk, i) => (
                                      <span key={tk.id || i}
                                        className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 shadow-xs">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                        <span className="font-mono font-bold">{tk.ticketNumber}</span>
                                        <span className="text-slate-400">{tk.type?.replace(/_/g, ' ')}</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-slate-400">{formatDate(tk.createdAt)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
            <span>Mostrando {filtered.length} de {clients.length} clientes</span>
            <span>{clients.reduce((acc, c) => acc + c.installedEquipment.length, 0)} equipos totales registrados</span>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedClient && <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
    </div>
  );
};
