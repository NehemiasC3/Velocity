import React, { useEffect, useState } from 'react';
import { 
  PackagePlus, Search, Filter, RefreshCw, X, Plus, 
  Cpu, Disc, Boxes, AlertTriangle, Check, Layers,
  Hash, ShieldCheck, Tag, Info, Sparkles, SlidersHorizontal
} from 'lucide-react';
import { api } from '../services/api';
import { ProductCatalog, ItemCategory, TrackingType, UnitOfMeasure } from '../types';
import { useAuth } from '../context/AuthContext';

export const CatalogModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTrackingType, setSelectedTrackingType] = useState<string>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    brand: '',
    model: '',
    description: '',
    category: 'ONU_ONT' as ItemCategory,
    trackingType: 'SERIALIZED' as TrackingType,
    unitOfMeasure: 'UNIDADES' as UnitOfMeasure,
    minStockAlert: 10
  });

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setErrorToast(null);
      const res = await api.getCatalog();
      if (res && res.products) {
        setProducts(res.products);
      }
    } catch (err: any) {
      console.error('Error cargando catálogo:', err);
      setErrorToast(err.message || 'Error al conectar con el catálogo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Autogenerar SKU inteligente
  const handleAutoGenerateSku = () => {
    const prefixMap: Record<ItemCategory, string> = {
      ONU_ONT: 'ONU',
      ROUTER_WIFI: 'RTR',
      CABLE_DROP: 'DRP',
      CONECTORIZACION: 'CON',
      HERRAJE_PLANTA_EXTERNA: 'HER',
      HERRAMIENTA_EQUIPO: 'EQP',
      MISCELANEOS: 'MISC'
    };

    const prefix = prefixMap[formData.category] || 'PRD';
    const brandPart = (formData.brand || 'GEN').slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    const namePart = (formData.name || 'ITEM').slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    const rand = Math.floor(100 + Math.random() * 900);

    const generated = `${prefix}-${brandPart}-${namePart}${rand}`;
    setFormData(prev => ({ ...prev, sku: generated }));
  };

  // Cambio de Categoría ajusta trackingType y unitOfMeasure sugeridos
  const handleCategoryChange = (cat: ItemCategory) => {
    let suggestedTracking: TrackingType = 'BULK';
    let suggestedUnit: UnitOfMeasure = 'UNIDADES';

    if (cat === 'ONU_ONT' || cat === 'ROUTER_WIFI') {
      suggestedTracking = 'SERIALIZED';
      suggestedUnit = 'UNIDADES';
    } else if (cat === 'CABLE_DROP') {
      suggestedTracking = 'BATCHED';
      suggestedUnit = 'METROS';
    } else if (cat === 'CONECTORIZACION' || cat === 'HERRAJE_PLANTA_EXTERNA') {
      suggestedTracking = 'BULK';
      suggestedUnit = 'UNIDADES';
    }

    setFormData(prev => ({
      ...prev,
      category: cat,
      trackingType: suggestedTracking,
      unitOfMeasure: suggestedUnit
    }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorToast(null);

      await api.createCatalogProduct({
        sku: formData.sku.trim() || undefined,
        name: formData.name.trim(),
        brand: formData.brand.trim() || undefined,
        model: formData.model.trim() || undefined,
        description: formData.description.trim() || undefined,
        category: formData.category,
        trackingType: formData.trackingType,
        unitOfMeasure: formData.unitOfMeasure,
        minStockAlert: Number(formData.minStockAlert) || 10
      });

      setSuccessToast(`Producto "${formData.name}" registrado correctamente.`);
      setTimeout(() => setSuccessToast(null), 4000);

      setShowModal(false);
      setFormData({
        sku: '',
        name: '',
        brand: '',
        model: '',
        description: '',
        category: 'ONU_ONT',
        trackingType: 'SERIALIZED',
        unitOfMeasure: 'UNIDADES',
        minStockAlert: 10
      });

      await loadCatalog();
    } catch (err: any) {
      setErrorToast(err.message || 'Error al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper de badges para Tracking Type
  const getTrackingTypeBadge = (type: TrackingType) => {
    switch (type) {
      case 'SERIALIZED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Seriado (MAC/SN)</span>
          </span>
        );
      case 'BATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Disc className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Lotes / Bobinas</span>
          </span>
        );
      case 'BULK':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Boxes className="w-3.5 h-3.5 text-slate-500" />
            <span>Granel / Unidades</span>
          </span>
        );
    }
  };

  // Helper para nombres legibles de Categoría
  const formatCategoryName = (cat: ItemCategory) => {
    switch (cat) {
      case 'ONU_ONT': return 'ONU / ONT';
      case 'ROUTER_WIFI': return 'Router WiFi';
      case 'CABLE_DROP': return 'Cable Drop';
      case 'CONECTORIZACION': return 'Conectorización';
      case 'HERRAJE_PLANTA_EXTERNA': return 'Herrajes & NAPs';
      case 'HERRAMIENTA_EQUIPO': return 'Herramientas';
      case 'MISCELANEOS': return 'Misceláneos';
      default: return cat;
    }
  };

  // Filtrado de productos
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesTracking = selectedTrackingType === 'ALL' || p.trackingType === selectedTrackingType;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model && p.model.toLowerCase().includes(q));
    
    return matchesCat && matchesTracking && matchesSearch;
  });

  return (
    <div className="space-y-6">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white">
                Catálogo Central de Materiales & Equipos
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Diccionario maestro para control seriado (ONUs), lotes/metraje (Bobinas) y existencias a granel
              </p>
            </div>
          </div>
        </div>

        {/* Botón Principal y Refresh */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Producto</span>
          </button>

          <button
            onClick={loadCatalog}
            title="Recargar catálogo"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Toasts */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* ── Filtros y Buscador ── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        
        {/* Barra superior de filtros */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Buscador */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por SKU, nombre, marca, modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Filtro por Naturaleza / Tracking Type */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-slate-400 px-2 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Control:
            </span>
            <button
              onClick={() => setSelectedTrackingType('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedTrackingType === 'ALL'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setSelectedTrackingType('SERIALIZED')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedTrackingType === 'SERIALIZED'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
              }`}
            >
              Seriado (MAC)
            </button>
            <button
              onClick={() => setSelectedTrackingType('BATCHED')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedTrackingType === 'BATCHED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
              }`}
            >
              Bobinas (Metros)
            </button>
            <button
              onClick={() => setSelectedTrackingType('BULK')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                selectedTrackingType === 'BULK'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Granel
            </button>
          </div>

        </div>

        {/* Chips de Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 dark:border-slate-800/60 pt-2.5">
          <span className="text-[11px] font-bold text-slate-400 px-1">Categorías:</span>
          {[
            { id: 'ALL', label: 'Todas' },
            { id: 'ONU_ONT', label: 'ONUs / ONTs' },
            { id: 'ROUTER_WIFI', label: 'Routers WiFi' },
            { id: 'CABLE_DROP', label: 'Cable Drop' },
            { id: 'CONECTORIZACION', label: 'Conectorización' },
            { id: 'HERRAJE_PLANTA_EXTERNA', label: 'Herrajes & NAPs' },
            { id: 'HERRAMIENTA_EQUIPO', label: 'Herramientas' },
            { id: 'MISCELANEOS', label: 'Misceláneos' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Data Table de Productos del Catálogo ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">SKU / Código</th>
                <th className="py-3.5 px-4">Nombre del Material</th>
                <th className="py-3.5 px-4">Marca & Modelo</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4">Tipo de Seguimiento</th>
                <th className="py-3.5 px-4">Unidad</th>
                <th className="py-3.5 px-4 text-center">Alerta Mín.</th>
                <th className="py-3.5 px-4 text-center">Stock Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                    Cargando catálogo maestro...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <PackagePlus className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No se encontraron productos en el catálogo</p>
                    <p className="text-xs text-slate-400 mt-0.5">Ajusta los filtros o agrega un nuevo producto con el botón superior.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const totalLinked =
                    (product._count?.serializedItems || 0) +
                    (product._count?.batchItems || 0) +
                    (product._count?.bulkStocks || 0);

                  return (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      
                      {/* SKU */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-900/60">
                          {product.sku}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {product.name}
                        </span>
                        {product.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {product.description}
                          </p>
                        )}
                      </td>

                      {/* Marca y Modelo */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {product.brand || product.model ? (
                          <span>
                            <strong className="text-slate-800 dark:text-slate-200">{product.brand || '—'}</strong>
                            {product.model ? ` • ${product.model}` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No especificado</span>
                        )}
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                          {formatCategoryName(product.category)}
                        </span>
                      </td>

                      {/* Tipo de Seguimiento (Naturaleza) */}
                      <td className="py-3.5 px-4">
                        {getTrackingTypeBadge(product.trackingType)}
                      </td>

                      {/* Unidad */}
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                        {product.unitOfMeasure}
                      </td>

                      {/* Alerta de Stock Mínimo */}
                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                        &lt; {product.minStockAlert}
                      </td>

                      {/* Registros de Stock */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {totalLinked} {totalLinked === 1 ? 'registro' : 'registros'}
                        </span>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: NUEVO PRODUCTO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                    Alta de Producto en Catálogo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define la plantilla maestra para seguimiento y control de inventario
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              
              {/* Categoría (Determinante para el tracking) */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Categoría del Material *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value as ItemCategory)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="ONU_ONT">🔌 ONU / ONT (Terminal Óptico)</option>
                  <option value="ROUTER_WIFI">📶 Router WiFi / Access Point / Mesh</option>
                  <option value="CABLE_DROP">🌀 Cable Drop (Bobinas / Fibra Óptica)</option>
                  <option value="CONECTORIZACION">🧩 Conectorización (SC/APC, Acopladores)</option>
                  <option value="HERRAJE_PLANTA_EXTERNA">🏗️ Herrajes, Tensores & Cajas NAP</option>
                  <option value="HERRAMIENTA_EQUIPO">🛠️ Herramientas & Equipos de Medición</option>
                  <option value="MISCELANEOS">📦 Consumibles y Misceláneos</option>
                </select>
              </div>

              {/* Nombre del Producto */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bobina Drop 1 Hilo G.657A2 (1000m), ONU Huawei EG8145V5, Conector Rápido SC/APC"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* SKU con Botón de Autogenerar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-bold">
                    Código SKU / Identificador Único *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Autogenerar SKU</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ej. ONU-HUA-EG8145, DRP-OPT-1000M"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono uppercase font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Marca y Modelo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Huawei, ZTE, Optictimes, 3M"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Modelo / Especificación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. EG8145V5, 1 Hilo 1000M, SC/APC"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* ── Naturaleza del Control (trackingType) ── */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5 flex items-center justify-between">
                  <span>Naturaleza del Seguimiento (Tracking Type) *</span>
                  <span className="text-[11px] text-slate-400 font-normal">Define cómo se contabiliza en bodegas</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  
                  {/* Tarjeta 1: SERIALIZED */}
                  <div
                    onClick={() => setFormData({ ...formData, trackingType: 'SERIALIZED' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.trackingType === 'SERIALIZED'
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                      <Cpu className="w-4 h-4" />
                      <span className="font-bold text-xs">Seriado</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Control por MAC/Serial único (ONUs, Routers).
                    </p>
                  </div>

                  {/* Tarjeta 2: BATCHED */}
                  <div
                    onClick={() => setFormData({ ...formData, trackingType: 'BATCHED', unitOfMeasure: 'METROS' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.trackingType === 'BATCHED'
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                      <Disc className="w-4 h-4" />
                      <span className="font-bold text-xs">Lotes / Bobinas</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Control por Metraje inicial y remanente (Cable Drop).
                    </p>
                  </div>

                  {/* Tarjeta 3: BULK */}
                  <div
                    onClick={() => setFormData({ ...formData, trackingType: 'BULK' })}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      formData.trackingType === 'BULK'
                        ? 'bg-slate-200/80 dark:bg-slate-700 border-slate-500 ring-2 ring-slate-500/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 mb-1">
                      <Boxes className="w-4 h-4" />
                      <span className="font-bold text-xs">Granel</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Suma y resta por unidades (Conectores, Tensores).
                    </p>
                  </div>

                </div>
              </div>

              {/* Unidad de Medida y Alerta de Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value as UnitOfMeasure })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-semibold outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="UNIDADES">UNIDADES</option>
                    <option value="METROS">METROS</option>
                    <option value="ROLLOS">ROLLOS</option>
                    <option value="CAJAS">CAJAS</option>
                    <option value="KITS">KITS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Alerta de Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Descripción Opcional */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Descripción / Observaciones Técnicas (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre compatibilidad, empaque o instrucciones de uso..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Guardar en Catálogo</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
