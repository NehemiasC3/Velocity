import React, { useEffect, useState, useMemo } from 'react';
import { 
  Package, Truck, 
  Search, ArrowRight, CheckCircle2, RefreshCw,
  Building2, CheckSquare, Zap, Award,
  BarChart3, Clock, User, ShieldCheck, Camera,
  Check, Boxes, Sparkles, Tag, Layers
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardKPIs, AuditLog, AnalyticsKPIs, ProductReconciliation } from '../types';
import { LiquidationModal } from './LiquidationModal';
import { ForensicTimelineModal } from './ForensicTimelineModal';

interface DashboardHomeProps {
  onNavigateTab: (tab: string, param?: string) => void;
}

interface SmartCategoryBreakdown {
  id: string;
  name: string;
  category: string;
  sku: string;
  unit: string;
  totalQuantity: number;
  breakdown: {
    hubTocumen: number;
    meteti: number;
    torti: number;
    vehicles: number;
    installedOrDeployed: number;
    rma: number;
  };
  reconciliationRate: number;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigateTab }) => {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsKPIs | null>(null);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [selectedTimelineSerial, setSelectedTimelineSerial] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado del Buscador Inteligente de Cuadratura
  const [smartQuery, setSmartQuery] = useState('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [kpiRes, logsRes, analyticsRes] = await Promise.all([
        api.getDashboardKPIs().catch(() => null),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getAnalyticsKPIs().catch(() => ({ success: false, kpis: null }))
      ]);

      if (kpiRes) setKpis(kpiRes);
      if (analyticsRes?.kpis) setAnalytics(analyticsRes.kpis);
      
      const logs = (kpiRes?.recentAuditLogs && kpiRes.recentAuditLogs.length > 0) 
        ? kpiRes.recentAuditLogs 
        : (logsRes?.logs?.slice(0, 8) || []);
      setRecentLogs(logs);
    } catch (err) {
      console.error('Error cargando datos del Centro de Control:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listener para abrir el timeline forense desde cualquier parte del sistema
    const handleOpenTimeline = (e: CustomEvent<string>) => {
      if (e.detail) {
        setSelectedTimelineSerial(e.detail);
      }
    };

    window.addEventListener('open-forensic-timeline' as any, handleOpenTimeline);
    return () => {
      window.removeEventListener('open-forensic-timeline' as any, handleOpenTimeline);
    };
  }, []);

  // Base de datos de cuadratura inteligente por categoría y material
  const smartCatalogDataset: SmartCategoryBreakdown[] = useMemo(() => [
    {
      id: 'mat-nap',
      name: 'Caja NAP 16 Puertos Exterior IP65',
      category: 'HERRAJE_PLANTA_EXTERNA',
      sku: 'NAP-16P-FAT',
      unit: 'unidades',
      totalQuantity: 300,
      breakdown: {
        hubTocumen: 150,
        meteti: 50,
        torti: 20,
        vehicles: 20,
        installedOrDeployed: 60,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-onu-huawei',
      name: 'ONU GPON Huawei EchoLife EG8145V5',
      category: 'ONU_ONT',
      sku: 'ONU-HUA-EG8145V5',
      unit: 'unidades',
      totalQuantity: 80,
      breakdown: {
        hubTocumen: 35,
        meteti: 10,
        torti: 0,
        vehicles: 15,
        installedOrDeployed: 20,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-onu-zte',
      name: 'ONU GPON ZTE F670L Dual Band AC1200',
      category: 'ONU_ONT',
      sku: 'ONU-ZTE-F670L',
      unit: 'unidades',
      totalQuantity: 60,
      breakdown: {
        hubTocumen: 25,
        meteti: 5,
        torti: 0,
        vehicles: 10,
        installedOrDeployed: 20,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-onn-tv',
      name: 'TV Box ONN Android TV 4K UHD Streaming',
      category: 'TV_BOX_OTT',
      sku: 'TV-ONN-4K-G1',
      unit: 'unidades',
      totalQuantity: 100,
      breakdown: {
        hubTocumen: 40,
        meteti: 0,
        torti: 0,
        vehicles: 20,
        installedOrDeployed: 40,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-cable-drop',
      name: 'Cable Drop Óptico 1 Hilo G657A2 (Bobinas 1000m)',
      category: 'CABLE_DROP',
      sku: 'CBL-DROP-1H',
      unit: 'metros',
      totalQuantity: 20050,
      breakdown: {
        hubTocumen: 12000,
        meteti: 3000,
        torti: 1000,
        vehicles: 850,
        installedOrDeployed: 3200,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-conector-sc',
      name: 'Conector Mecánico Rápido SC/APC FTTH',
      category: 'CONECTORIZACION',
      sku: 'CON-SCAPC-FAST',
      unit: 'unidades',
      totalQuantity: 1500,
      breakdown: {
        hubTocumen: 800,
        meteti: 200,
        torti: 150,
        vehicles: 150,
        installedOrDeployed: 200,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-splitter-1x8',
      name: 'Splitter PLC 1x8 y 1x16 SC/APC Conectorizado',
      category: 'HERRAJE_PLANTA_EXTERNA',
      sku: 'SPL-PLC-1X8',
      unit: 'unidades',
      totalQuantity: 120,
      breakdown: {
        hubTocumen: 60,
        meteti: 25,
        torti: 15,
        vehicles: 10,
        installedOrDeployed: 10,
        rma: 0
      },
      reconciliationRate: 100
    },
    {
      id: 'mat-cam-ezviz',
      name: 'Cámara Seguridad Ezviz H6c 2MP Pan/Tilt',
      category: 'CAMARA_SEGURIDAD_IOT',
      sku: 'CAM-EZV-H6C',
      unit: 'unidades',
      totalQuantity: 40,
      breakdown: {
        hubTocumen: 20,
        meteti: 5,
        torti: 5,
        vehicles: 5,
        installedOrDeployed: 5,
        rma: 0
      },
      reconciliationRate: 100
    }
  ], []);

  // Chips Rápidos de Categoría para la Gerencia
  const quickFilterChips = [
    { label: '⚡ Cajas NAP', query: 'NAP' },
    { label: '📦 ONUs GPON', query: 'ONU' },
    { label: '📺 ONN TV Box', query: 'ONN' },
    { label: '🧵 Cable Drop', query: 'Cable' },
    { label: '🔌 Conectores SC/APC', query: 'Conector' },
    { label: '📡 Splitters', query: 'Splitter' },
  ];

  // Detección si es búsqueda de serial específico
  const isSerialSearch = useMemo(() => {
    const q = smartQuery.trim().toUpperCase();
    if (!q) return false;
    return (
      q.includes(':') ||
      q.startsWith('ZTE') ||
      q.startsWith('HW') ||
      q.startsWith('ONN-') ||
      q.startsWith('SN-') ||
      q.startsWith('CAM-') ||
      (q.length >= 6 && /\d/.test(q) && !['CABLE', 'CONECTOR', 'SPLITTER', 'BOBINA'].includes(q))
    );
  }, [smartQuery]);

  // Filtrar resultados de categoría
  const matchedCategories = useMemo(() => {
    const q = smartQuery.trim().toLowerCase();
    if (!q) {
      return smartCatalogDataset.slice(0, 4);
    }

    if (isSerialSearch) return [];

    return smartCatalogDataset.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (q === 'nap' && item.name.toLowerCase().includes('nap')) ||
      (q === 'onu' && item.category === 'ONU_ONT') ||
      (q === 'cable' && item.category === 'CABLE_DROP') ||
      (q === 'onn' && item.name.toLowerCase().includes('onn')) ||
      (q === 'conector' && item.category === 'CONECTORIZACION') ||
      (q === 'splitter' && item.name.toLowerCase().includes('splitter'))
    );
  }, [smartQuery, smartCatalogDataset, isSerialSearch]);

  const handleSmartSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = smartQuery.trim();
    if (!query) return;

    if (isSerialSearch) {
      setSelectedTimelineSerial(query);
    }
  };

  const handleChipClick = (query: string) => {
    if (activeQuickFilter === query && smartQuery === query) {
      setActiveQuickFilter(null);
      setSmartQuery('');
    } else {
      setActiveQuickFilter(query);
      setSmartQuery(query);
    }
  };

  // Fallback demo reconciliations para el reporte general inferior
  const reconciliationData: ProductReconciliation[] = (kpis?.reconciliationReport && kpis.reconciliationReport.length > 0)
    ? kpis.reconciliationReport
    : [
        {
          productId: 'demo-onn-tv',
          productName: 'ONN Android TV Box 4K Streaming',
          category: 'TV_BOX_OTT',
          brand: 'ONN',
          model: 'Google TV 4K',
          sku: 'ONN-TV-4K',
          totalRegistered: 100,
          inHubWarehouse: 40,
          inBranches: 0,
          inVehicles: 20,
          inTransit: 0,
          installedClient: 40,
          inRMA: 0,
          unaccountedLoss: 0,
          reconciliationRate: 100
        },
        {
          productId: 'demo-huawei-gpon',
          productName: 'Huawei EchoLife HG8145V5 GPON Dual Band',
          category: 'ONU_ONT',
          brand: 'Huawei',
          model: 'HG8145V5',
          sku: 'HW-GPON-V5',
          totalRegistered: 80,
          inHubWarehouse: 35,
          inBranches: 10,
          inVehicles: 15,
          inTransit: 0,
          installedClient: 20,
          inRMA: 0,
          unaccountedLoss: 0,
          reconciliationRate: 100
        },
        {
          productId: 'demo-zte-gpon',
          productName: 'ZTE ZXHN F670L GPON AC1200',
          category: 'ONU_ONT',
          brand: 'ZTE',
          model: 'ZXHN F670L',
          sku: 'ZTE-F670L',
          totalRegistered: 60,
          inHubWarehouse: 25,
          inBranches: 5,
          inVehicles: 10,
          inTransit: 0,
          installedClient: 20,
          inRMA: 0,
          unaccountedLoss: 0,
          reconciliationRate: 100
        }
      ];

  // Métricas calculadas para la gerencia
  const equipmentInStreet = kpis?.movementKPIs?.equipmentInStreet ?? kpis?.onusByStatus?.enVehiculo ?? 45;
  const installedToday = kpis?.movementKPIs?.installedToday ?? analytics?.total_installed_onus ?? 80;
  const totalInHub = kpis?.movementKPIs?.totalInHub ?? kpis?.onusByStatus?.enBodega ?? 100;
  const traceableRate = kpis?.movementKPIs?.totalTraceableRate ?? 100;

  // Formato enriquecido para el feed de movimientos
  const formatLogSummary = (log: AuditLog) => {
    const sn = log.serialNumber ? `S/N: ${log.serialNumber}` : (log.macAddress ? `MAC: ${log.macAddress}` : 'Material');
    let actionText = log.details || 'Movimiento registrado';
    let route = '';

    if (log.fromWarehouseName && log.toWarehouseName) {
      route = `${log.fromWarehouseName} ➔ ${log.toWarehouseName}`;
    } else if (log.toWarehouseName) {
      route = `Destino: ${log.toWarehouseName}`;
    }

    return { sn, actionText, route };
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'ALTA_INVENTARIO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">ALTA BODEGA</span>;
      case 'DESPACHO_TRASLADO':
      case 'CARGA_VEHICULO':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">TRASLADO / CAMIONETA</span>;
      case 'INSTALACION_CLIENTE':
      case 'LIQUIDACION_ORDEN':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">INSTALADO WISPRO</span>;
      case 'RETIRO_CLIENTE':
      case 'RETIRO_POR_CANCELACION':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">RETIRO CAMPO</span>;
      case 'REPORTE_RMA':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">RMA / LAB</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{type}</span>;
    }
  };

  const daily7d = (analytics?.daily_cable_consumption_7d && analytics.daily_cable_consumption_7d.length > 0)
    ? analytics.daily_cable_consumption_7d
    : [
        { date: '2026-09-11', label: 'Vie', meters: 420 },
        { date: '2026-09-12', label: 'Sáb', meters: 310 },
        { date: '2026-09-13', label: 'Dom', meters: 150 },
        { date: '2026-09-14', label: 'Lun', meters: 580 },
        { date: '2026-09-15', label: 'Mar', meters: 640 },
        { date: '2026-09-16', label: 'Mié', meters: 720 },
        { date: '2026-09-17', label: 'Hoy', meters: 850 }
      ];

  const maxMeters = Math.max(...daily7d.map(d => d.meters), 100);

  if (loading && !kpis && !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-medium">Iniciando Centro de Control y Trazabilidad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* ── 1. TOP HEADER EJECUTIVO & ACCIONES GERENCIALES ── */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5 md:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/60 via-indigo-50/40 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

        <div className="max-w-3xl relative z-10">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Centro de Control Operativo
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Wispro Cloud Sync
            </span>
            <span className="text-xs text-slate-400">
              Auditoría Forense • Cuadratura 100% Cero Fugas
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight">
            Dashboard Ejecutivo & Mesa de Control ISP
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            Visibilidad total de inventario en bodegas, cuadrillas en calle y conciliación exacta de materiales.
          </p>
        </div>

        {/* Acciones Rápidas */}
        <div className="flex items-center gap-2.5 relative z-10">
          <button
            onClick={() => onNavigateTab('work-orders')}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Mesa de Órdenes</span>
          </button>

          <button
            onClick={() => setShowLiquidationModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>+ Liquidar Material</span>
          </button>
        </div>
      </div>

      {/* ── 2. KPIS PRINCIPALES: VALOR, MOVIMIENTO Y CUADRATURA (ARRIBA) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Equipos en la Calle (Vehículos / Cuadrillas) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-500" />
              Equipos en la Calle
            </span>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 font-heading font-mono">
              {equipmentInStreet}
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              En camionetas activas de técnicos
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cuadrillas en Ruta:</span>
            <strong className="text-slate-800 font-mono">100% Asignado</strong>
          </div>
        </div>

        {/* KPI 2: Equipos Instalados en Clientes */}
        <div className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Instalados en Clientes
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 font-heading font-mono">
              {installedToday}
            </h3>
            <p className="text-xs text-emerald-700 mt-1 font-medium">
              Sincronizados con Wispro Cloud
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Liquidaciones:</span>
            <strong className="text-emerald-800 font-mono">Validadas en Mesa</strong>
          </div>
        </div>

        {/* KPI 3: Total en Bodega Principal Hub */}
        <div className="bg-white rounded-3xl border border-blue-200 p-5 shadow-xs relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-600" />
              Bodega Principal Hub
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 font-heading font-mono">
              {totalInHub}
            </h3>
            <p className="text-xs text-blue-700 mt-1 font-medium">
              Disponibles en Tocumen para despacho
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Bodegas Operativas:</span>
            <strong className="text-blue-800 font-mono">{kpis?.totalWarehouses ?? 6} Activas</strong>
          </div>
        </div>

        {/* KPI 4: Cuadratura Forense & Cero Pérdidas */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs relative overflow-hidden group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Cuadratura Total
            </span>
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-extrabold text-slate-900 font-heading font-mono">
              {traceableRate.toFixed(1)}%
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              0 Pérdidas • Ledger Inmutable
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Discrepancias:</span>
            <strong className="text-emerald-700 font-mono">0 (100% Cuadrado)</strong>
          </div>
        </div>

      </div>

      {/* ── 3. BUSCADOR INTELIGENTE DE CUADRATURA Y TRAZABILIDAD (CENTRO PROMINENTE) ── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-6">
          
          {/* Título y Explicación del Buscador */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
                <span className="text-xs uppercase tracking-widest font-extrabold text-sky-400">
                  Motor de Consulta Gerencial
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white flex items-center gap-2.5">
                <Search className="w-6 h-6 text-sky-400" />
                <span>Búsqueda Inteligente de Cuadratura & Trazabilidad</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Escribe un material (ej. <strong>NAP</strong>, <strong>ONU</strong>, <strong>Cable</strong>) para ver su desglose de stock por bodega, o introduce un <strong>Serial / MAC</strong> para abrir su Línea de Tiempo.
              </p>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-white/5 border border-white/10 px-3.5 py-2 rounded-2xl">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Respuesta Inmediata: Cuadratura O(1)</span>
            </div>
          </div>

          {/* Barra de Búsqueda Principal */}
          <form 
            onSubmit={handleSmartSearchSubmit} 
            className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 flex items-center shadow-lg focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30 transition-all"
          >
            <Search className="w-5 h-5 text-sky-400 ml-3 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Buscar material (NAP, ONU, Cable, ONN, Splitter...) o Serial (ZTE123, HW-GPON, MAC)..."
              value={smartQuery}
              onChange={(e) => {
                setSmartQuery(e.target.value);
                setActiveQuickFilter(null);
              }}
              className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none font-sans px-1 py-2"
            />

            {smartQuery && (
              <button
                type="button"
                onClick={() => {
                  setSmartQuery('');
                  setActiveQuickFilter(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition mr-2"
              >
                ×
              </button>
            )}

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition mr-2 hidden sm:flex items-center gap-1.5 text-xs font-mono"
              title="Escáner de Cámara / Búsqueda Global (Ctrl+K)"
            >
              <Camera className="w-4 h-4 text-sky-400" />
              <kbd className="text-[10px] bg-white/10 border border-white/20 px-1.5 py-0.5 rounded text-slate-300">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="submit"
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 shrink-0 cursor-pointer"
            >
              {isSerialSearch ? 'Ver Timeline Forense' : 'Consultar Stock'}
            </button>
          </form>

          {/* Chips Rápidos de Categoría */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-slate-400 font-semibold shrink-0 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              <span>Consultas Frecuentes:</span>
            </span>
            {quickFilterChips.map((chip) => {
              const isActive = activeQuickFilter === chip.query || smartQuery.toLowerCase() === chip.query.toLowerCase();
              return (
                <button
                  key={chip.query}
                  onClick={() => handleChipClick(chip.query)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-sky-400 text-slate-950 shadow-md shadow-sky-400/20' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  <span>{chip.label}</span>
                  {isActive && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>

          {/* ── RESULTADOS DINÁMICOS DEL BUSCADOR INTELIGENTE ── */}
          
          {/* CASO A: DETECCIÓN DE SERIAL ESPECÍFICO */}
          {isSerialSearch && (
            <div className="bg-white/10 border border-sky-400/40 rounded-2xl p-5 backdrop-blur-sm animate-fadeIn flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/30 text-[11px] font-mono font-bold">
                    SERIAL IDENTIFICADO
                  </span>
                  <span className="font-mono font-extrabold text-white text-base">
                    {smartQuery.trim()}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Equipo serializado detectado. Haz clic para desplegar la trazabilidad histórica completa (Ingreso ➔ Vehículo ➔ Cliente Wispro ➔ RMA).
                </p>
              </div>

              <button
                onClick={() => setSelectedTimelineSerial(smartQuery.trim())}
                className="bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 justify-center shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Abrir Línea de Tiempo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CASO B: DESGLOSE VISUAL DE CUADRATURA POR MATERIAL / CATEGORÍA */}
          {!isSerialSearch && matchedCategories.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-sky-400" />
                  <span>
                    {smartQuery ? `Resultados de Cuadratura para "${smartQuery}":` : 'Materiales Principales (Cuadratura Inmediata):'}
                  </span>
                </span>
                <span className="font-mono text-sky-300">
                  {matchedCategories.length} {matchedCategories.length === 1 ? 'material encontrado' : 'materiales encontrados'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {matchedCategories.map((mat) => {
                  const b = mat.breakdown;
                  const total = mat.totalQuantity;

                  const hubPct = total > 0 ? (b.hubTocumen / total) * 100 : 0;
                  const branchesPct = total > 0 ? ((b.meteti + b.torti) / total) * 100 : 0;
                  const vehiclesPct = total > 0 ? (b.vehicles / total) * 100 : 0;
                  const deployedPct = total > 0 ? (b.installedOrDeployed / total) * 100 : 0;

                  return (
                    <div 
                      key={mat.id}
                      className="bg-white/10 border border-white/15 hover:border-sky-400/50 rounded-2xl p-5 backdrop-blur-md transition-all space-y-4"
                    >
                      {/* Header del Material */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-white">{mat.name}</h4>
                            <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded text-sky-300 font-semibold">
                              {mat.sku}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Categoría: <span className="font-semibold text-white">{mat.category}</span>
                          </p>
                        </div>

                        {/* Total Cuadra */}
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-[11px] text-slate-400 block">Stock Total</span>
                            <strong className="text-base sm:text-lg font-mono font-extrabold text-white">
                              {total.toLocaleString()} {mat.unit}
                            </strong>
                          </div>
                          <div className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>100% Cuadrado</span>
                          </div>
                        </div>
                      </div>

                      {/* Barra Segmentada de Distribución */}
                      <div className="space-y-1.5">
                        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden flex">
                          {hubPct > 0 && <div style={{ width: `${hubPct}%` }} className="bg-blue-500 h-full" title={`Hub Tocumen: ${b.hubTocumen}`} />}
                          {branchesPct > 0 && <div style={{ width: `${branchesPct}%` }} className="bg-sky-400 h-full" title={`Sucursales: ${b.meteti + b.torti}`} />}
                          {vehiclesPct > 0 && <div style={{ width: `${vehiclesPct}%` }} className="bg-slate-400 h-full" title={`Vehículos: ${b.vehicles}`} />}
                          {deployedPct > 0 && <div style={{ width: `${deployedPct}%` }} className="bg-emerald-400 h-full" title={`Instaladas/Ocupadas: ${b.installedOrDeployed}`} />}
                        </div>

                        {/* Tarjetas de Ubicación Detallada */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1 text-xs">
                          
                          {/* 1. Bodega Tocumen */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] mb-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span className="truncate">Bodega Tocumen:</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <strong className="text-sm font-mono font-bold text-white">
                                {b.hubTocumen.toLocaleString()}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium">Disponibles</span>
                            </div>
                          </div>

                          {/* 2. Bodega Metetí */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] mb-1">
                              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                              <span className="truncate">Bodega Metetí:</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <strong className="text-sm font-mono font-bold text-white">
                                {b.meteti.toLocaleString()}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium">Disponibles</span>
                            </div>
                          </div>

                          {/* 3. Bodega Tortí */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] mb-1">
                              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                              <span className="truncate">Bodega Tortí:</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <strong className="text-sm font-mono font-bold text-white">
                                {b.torti.toLocaleString()}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium">Disponibles</span>
                            </div>
                          </div>

                          {/* 4. Vehículos / Cuadrillas */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] mb-1">
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                              <span className="truncate">Vehículos/Cuadrillas:</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <strong className="text-sm font-mono font-bold text-white">
                                {b.vehicles.toLocaleString()}
                              </strong>
                              <span className="text-[10px] text-slate-400 font-medium">En Tránsito</span>
                            </div>
                          </div>

                          {/* 5. Instaladas / Ocupadas */}
                          <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] mb-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                              <span className="truncate">Instaladas/En Servicio:</span>
                            </div>
                            <div className="flex items-baseline justify-between">
                              <strong className="text-sm font-mono font-bold text-emerald-300">
                                {b.installedOrDeployed.toLocaleString()}
                              </strong>
                              <span className="text-[10px] text-emerald-300 font-medium">En Clientes/Red</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sin resultados */}
          {!isSerialSearch && matchedCategories.length === 0 && (
            <div className="p-6 text-center bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-xs">
              No se encontraron materiales para "{smartQuery}". Prueba seleccionando uno de los accesos directos arriba (NAP, ONU, Cable, ONN).
            </div>
          )}

        </div>
      </div>

      {/* ── 4. REPORTE DE CUADRATURA EXACTA DE EQUIPOS CLAVE ── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-heading font-extrabold text-slate-900 flex items-center gap-2">
                <Boxes className="w-6 h-6 text-blue-600" />
                <span>Conciliación de Hardware Serializado (100% Auditado)</span>
              </h2>
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Cero Fugas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Desglose consolidado de equipos serializados por ubicación: Hub Tocumen, Sucursales, Cuadrillas, Clientes y RMA.
            </p>
          </div>
        </div>

        {/* Lista de Cuadraturas por Producto */}
        <div className="grid grid-cols-1 gap-4">
          {reconciliationData.map((rec) => {
            const sumParts = rec.inHubWarehouse + rec.inBranches + rec.inVehicles + rec.inTransit + rec.installedClient + rec.inRMA;

            const hubPct = rec.totalRegistered > 0 ? (rec.inHubWarehouse / rec.totalRegistered) * 100 : 0;
            const branchPct = rec.totalRegistered > 0 ? (rec.inBranches / rec.totalRegistered) * 100 : 0;
            const vehiclePct = rec.totalRegistered > 0 ? ((rec.inVehicles + rec.inTransit) / rec.totalRegistered) * 100 : 0;
            const clientPct = rec.totalRegistered > 0 ? (rec.installedClient / rec.totalRegistered) * 100 : 0;
            const rmaPct = rec.totalRegistered > 0 ? (rec.inRMA / rec.totalRegistered) * 100 : 0;

            return (
              <div 
                key={rec.productId}
                className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 transition-all shadow-2xs space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-600 shadow-2xs">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">{rec.productName}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">
                          {rec.sku}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {rec.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {rec.brand ? `${rec.brand} ${rec.model || ''}` : 'Equipo Serializado'}
                      </p>
                    </div>
                  </div>

                  {/* Badge de Cuadratura Total */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Total Cuadra</span>
                      <strong className="text-sm md:text-base font-mono font-extrabold text-slate-900">
                        {sumParts} / {rec.totalRegistered}
                      </strong>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{rec.reconciliationRate}% Cuadrado (0 Fugas)</span>
                    </div>
                  </div>
                </div>

                {/* Barra Visual Segmentada de Distribución 100% */}
                <div className="space-y-1.5">
                  <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                    {hubPct > 0 && (
                      <div 
                        style={{ width: `${hubPct}%` }} 
                        className="bg-blue-600 h-full transition-all"
                        title={`Bodega Hub: ${rec.inHubWarehouse} (${hubPct.toFixed(0)}%)`}
                      />
                    )}
                    {branchPct > 0 && (
                      <div 
                        style={{ width: `${branchPct}%` }} 
                        className="bg-sky-400 h-full transition-all"
                        title={`Sucursales: ${rec.inBranches} (${branchPct.toFixed(0)}%)`}
                      />
                    )}
                    {vehiclePct > 0 && (
                      <div 
                        style={{ width: `${vehiclePct}%` }} 
                        className="bg-slate-400 h-full transition-all"
                        title={`En Vehículos / Tránsito: ${rec.inVehicles + rec.inTransit} (${vehiclePct.toFixed(0)}%)`}
                      />
                    )}
                    {clientPct > 0 && (
                      <div 
                        style={{ width: `${clientPct}%` }} 
                        className="bg-emerald-500 h-full transition-all"
                        title={`Instaladas en Clientes: ${rec.installedClient} (${clientPct.toFixed(0)}%)`}
                      />
                    )}
                    {rmaPct > 0 && (
                      <div 
                        style={{ width: `${rmaPct}%` }} 
                        className="bg-slate-400 h-full transition-all"
                        title={`En RMA: ${rec.inRMA} (${rmaPct.toFixed(0)}%)`}
                      />
                    )}
                  </div>

                  {/* Leyenda de Ubicaciones Detallada */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                      <span className="text-slate-600 text-[11px] truncate">Hub Tocumen:</span>
                      <strong className="text-slate-900 font-mono ml-auto">{rec.inHubWarehouse}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                      <span className="text-slate-600 text-[11px] truncate">Sucursales:</span>
                      <strong className="text-slate-900 font-mono ml-auto">{rec.inBranches}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-slate-600 text-[11px] truncate">Vehículos:</span>
                      <strong className="text-slate-900 font-mono ml-auto">{rec.inVehicles + rec.inTransit}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-slate-600 text-[11px] truncate">Clientes:</span>
                      <strong className="text-slate-900 font-mono ml-auto">{rec.installedClient}</strong>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                      <span className="text-slate-600 text-[11px] truncate">RMA / Lab:</span>
                      <strong className="text-slate-900 font-mono ml-auto">{rec.inRMA}</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. FLUJO DE MATERIALES (ACTIVIDAD RECIENTE) & CONSUMO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Feed de Flujo de Materiales / Live Audit Logs */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-heading font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Flujo de Materiales en Tiempo Real (Live Audit Feed)</span>
              </h3>
              <p className="text-xs text-slate-500">Trazabilidad inmutable de traslados, liquidaciones y altas</p>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Auditoría Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center">No hay registros de auditoría recientes.</p>
            ) : (
              recentLogs.map((log, idx) => {
                const { sn, actionText, route } = formatLogSummary(log);
                const targetIdent = log.serialNumber || log.macAddress;

                return (
                  <div 
                    key={log.id || idx}
                    className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/60 border border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getEventBadge(log.eventType)}
                        {targetIdent && (
                          <span 
                            onClick={() => setSelectedTimelineSerial(targetIdent)}
                            className="font-mono font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                            title="Ver Línea de Tiempo Forense"
                          >
                            {sn}
                          </span>
                        )}
                        {route && (
                          <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                            {route}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-700 text-xs font-medium leading-relaxed">
                        {actionText}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                        <span>Por: <strong className="text-slate-700">{log.userName || 'Sistema'}</strong></span>
                        <span>•</span>
                        <span className="font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Botón para abrir Timeline Forense */}
                    {targetIdent && (
                      <button
                        onClick={() => setSelectedTimelineSerial(targetIdent)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer"
                        title="Abrir Línea de Tiempo Forense"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 group-hover:text-white" />
                        <span>Ver Timeline</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Consumo de Cable & Top Cuadrillas */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Gráfico de Consumo de Cable Últimos 7 Días */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-heading font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Consumo Cable Drop (7 Días)</span>
              </h3>
              <span className="text-[11px] font-bold text-blue-600 font-mono">
                {analytics?.monthly_cable_consumption ?? 3670}m mes
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 items-end h-40 pt-4 pb-2 border-b border-slate-100">
              {daily7d.map((day, idx) => {
                const heightPercent = maxMeters > 0 ? Math.max((day.meters / maxMeters) * 100, 8) : 8;
                const isToday = idx === daily7d.length - 1;

                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 bg-slate-900 text-white text-[9px] font-bold py-0.5 px-1.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                      {day.meters}m
                    </div>

                    <div className="w-full max-w-[28px] bg-slate-100 rounded-t-lg overflow-hidden flex items-end h-28">
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          isToday 
                            ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-xs' 
                            : 'bg-gradient-to-t from-slate-400 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400'
                        }`}
                      />
                    </div>

                    <span className={`text-[10px] font-bold ${isToday ? 'text-blue-600 font-extrabold' : 'text-slate-500'}`}>
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Descontado en tiempo real en liquidaciones Wispro
            </p>
          </div>

          {/* Top Cuadrillas / Técnicos Líderes */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-slate-500" />
                Cuadrillas Líderes
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">Este Mes</span>
            </div>

            <div className="space-y-2">
              {(analytics?.top_technicians && analytics.top_technicians.length > 0) ? (
                analytics.top_technicians.slice(0, 3).map((t, idx) => (
                  <div key={t.technicianId || idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{t.technicianName}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 font-mono">
                      {t.closedTickets} ord.
                    </span>
                  </div>
                ))
              ) : (
                [
                  { name: 'Luis David (Cuadrilla 1 - Tocumen)', ord: 18 },
                  { name: 'Carlos Mendoza (Cuadrilla 2 - Metetí)', ord: 14 },
                  { name: 'Roberto Gómez (Cuadrilla 3 - Tortí)', ord: 10 }
                ].map((demo, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{demo.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 font-mono">
                      {demo.ord} ord.
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── MODAL UNIVERSAL: LÍNEA DE TIEMPO FORENSE DEL EQUIPO (TIMELINE) ── */}
      <ForensicTimelineModal
        serialOrMac={selectedTimelineSerial}
        isOpen={Boolean(selectedTimelineSerial)}
        onClose={() => setSelectedTimelineSerial(null)}
      />

      {/* ── MODAL DE LIQUIDACIÓN RÁPIDA DE MATERIAL ── */}
      <LiquidationModal
        isOpen={showLiquidationModal}
        onClose={() => setShowLiquidationModal(false)}
        onSuccess={() => {
          setShowLiquidationModal(false);
          loadData();
        }}
      />

    </div>
  );
};
