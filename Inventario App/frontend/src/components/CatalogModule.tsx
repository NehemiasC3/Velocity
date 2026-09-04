import React, { useEffect, useState } from 'react';
import { 
  PackagePlus, Search, RefreshCw, X, Plus, 
  Cpu, Disc, Boxes, AlertTriangle, Check,
  Sparkles, SlidersHorizontal, Eye, Edit2, Trash2,
  Building2, Truck, UserCheck, Wrench, Calendar,
  Key, Radio, FileText, ArrowUpDown
} from 'lucide-react';
import { api } from '../services/api';
import { ProductCatalog, ItemCategory, TrackingType, UnitOfMeasure, SerializedItem, BatchItem, BulkStock, SerializedStatus } from '../types';
import { useAuth } from '../context/AuthContext';

export const CatalogModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<ProductCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTrackingType, setSelectedTrackingType] = useState<string>('ALL');

  // Modal State: Crear Producto
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form State: Nuevo Producto
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

  // Modal State: Editar Producto
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductCatalog | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    brand: '',
    model: '',
    description: '',
    category: 'ONU_ONT' as ItemCategory,
    unitOfMeasure: 'UNIDADES' as UnitOfMeasure,
    minStockAlert: 10
  });

  // Modal State: Ficha de Trazabilidad & Stock
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductCatalog | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [detailStatusFilter, setDetailStatusFilter] = useState<'ALL' | SerializedStatus>('ALL');

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
      TV_BOX_OTT: 'TVB',
      CAMARA_SEGURIDAD_IOT: 'CAM',
      REPETIDOR_MESH: 'MSH',
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

    if (
      cat === 'ONU_ONT' || 
      cat === 'ROUTER_WIFI' || 
      cat === 'TV_BOX_OTT' || 
      cat === 'CAMARA_SEGURIDAD_IOT' || 
      cat === 'REPETIDOR_MESH'
    ) {
      suggestedTracking = 'SERIALIZED';
      suggestedUnit = 'UNIDADES';
    } else if (cat === 'CABLE_DROP') {
      suggestedTracking = 'BATCHED';
      suggestedUnit = 'METROS';
    } else if (cat === 'CONECTORIZACION' || cat === 'HERRAJE_PLANTA_EXTERNA' || cat === 'MISCELANEOS') {
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

  // Abrir Modal de Edición
  const handleOpenEdit = (product: ProductCatalog, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(product);
    setEditFormData({
      name: product.name,
      brand: product.brand || '',
      model: product.model || '',
      description: product.description || '',
      category: product.category,
      unitOfMeasure: product.unitOfMeasure,
      minStockAlert: product.minStockAlert
    });
    setShowEditModal(true);
  };

  // Guardar Cambios de Edición
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      setIsSubmitting(true);
      setErrorToast(null);

      await api.updateCatalogProduct(editingProduct.id, {
        name: editFormData.name.trim(),
        brand: editFormData.brand.trim() || undefined,
        model: editFormData.model.trim() || undefined,
        description: editFormData.description.trim() || undefined,
        category: editFormData.category,
        unitOfMeasure: editFormData.unitOfMeasure,
        minStockAlert: Number(editFormData.minStockAlert) || 10
      });

      setSuccessToast(`Producto "${editFormData.name}" actualizado correctamente.`);
      setTimeout(() => setSuccessToast(null), 4000);

      setShowEditModal(false);
      setEditingProduct(null);
      await loadCatalog();
    } catch (err: any) {
      setErrorToast(err.message || 'Error al actualizar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar Producto
  const handleDeleteProduct = async (product: ProductCatalog, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`¿Estás seguro de eliminar el producto "${product.name}" (${product.sku}) del catálogo?`);
    if (!confirmed) return;

    try {
      setErrorToast(null);
      const res = await api.deleteCatalogProduct(product.id);
      setSuccessToast(res.message || 'Producto eliminado o desactivado.');
      setTimeout(() => setSuccessToast(null), 4000);
      await loadCatalog();
    } catch (err: any) {
      setErrorToast(err.message || 'Error al eliminar el producto');
    }
  };

  // Abrir Ficha de Trazabilidad & Stock
  const handleOpenDetail = async (product: ProductCatalog) => {
    try {
      setLoadingDetail(true);
      setShowDetailModal(true);
      setDetailSearchQuery('');
      setDetailStatusFilter('ALL');
      const res = await api.getCatalogProduct(product.id);
      if (res && res.product) {
        setSelectedProductDetail(res.product);
      } else {
        setSelectedProductDetail(product);
      }
    } catch (err: any) {
      console.error('Error cargando detalle del producto:', err);
      setSelectedProductDetail(product);
    } finally {
      setLoadingDetail(false);
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
      case 'TV_BOX_OTT': return 'TV Box / OTT';
      case 'CAMARA_SEGURIDAD_IOT': return 'Cámaras & IoT';
      case 'REPETIDOR_MESH': return 'Repetidores Mesh';
      case 'CABLE_DROP': return 'Cable Drop';
      case 'CONECTORIZACION': return 'Conectorización';
      case 'HERRAJE_PLANTA_EXTERNA': return 'Herrajes & NAPs';
      case 'HERRAMIENTA_EQUIPO': return 'Herramientas';
      case 'MISCELANEOS': return 'Misceláneos';
      default: return cat;
    }
  };

  // Helper de badges de estado para items seriados
  const getSerializedStatusBadge = (status: SerializedStatus) => {
    switch (status) {
      case 'EN_BODEGA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Building2 className="w-3 h-3" /> En Bodega
          </span>
        );
      case 'EN_VEHICULO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Truck className="w-3 h-3" /> En Camioneta
          </span>
        );
      case 'INSTALADO_CLIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <UserCheck className="w-3 h-3" /> Instalado
          </span>
        );
      case 'RMA_DEFECTUOSO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Wrench className="w-3 h-3" /> RMA / Defecto
          </span>
        );
      case 'EN_TRANSITO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <ArrowUpDown className="w-3 h-3" /> En Tránsito
          </span>
        );
      case 'BAJA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {status}
          </span>
        );
    }
  };

  // Filtrado de productos en catálogo
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

  // Métricas del producto seleccionado para el detalle
  const detailSerialized = selectedProductDetail?.serializedItems || [];
  const detailBatches = selectedProductDetail?.batchItems || [];
  const detailBulk = selectedProductDetail?.bulkStocks || [];

  const countEnBodega = detailSerialized.filter(i => i.status === 'EN_BODEGA').length;
  const countEnVehiculo = detailSerialized.filter(i => i.status === 'EN_VEHICULO' || i.status === 'EN_TRANSITO').length;
  const countInstalado = detailSerialized.filter(i => i.status === 'INSTALADO_CLIENTE').length;
  const countRma = detailSerialized.filter(i => i.status === 'RMA_DEFECTUOSO').length;

  // Filtrado de items seriados en el modal de detalle
  const filteredDetailSerialized = detailSerialized.filter(item => {
    const matchesStatus = detailStatusFilter === 'ALL' || item.status === detailStatusFilter;
    const q = detailSearchQuery.toLowerCase();
    const matchesQuery = !q ||
      item.serialNumber.toLowerCase().includes(q) ||
      (item.macAddress && item.macAddress.toLowerCase().includes(q)) ||
      (item.verificationCode && item.verificationCode.toLowerCase().includes(q)) ||
      (item.installedClientName && item.installedClientName.toLowerCase().includes(q)) ||
      (item.installedContractId && item.installedContractId.toLowerCase().includes(q)) ||
      (item.currentWarehouse?.name && item.currentWarehouse.name.toLowerCase().includes(q));

    return matchesStatus && matchesQuery;
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
                Diccionario maestro con control de existencias, seriales (ONUs, TV Box, Cámaras), lotes de fibra y granel
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
            { id: 'REPETIDOR_MESH', label: 'Repetidores Mesh' },
            { id: 'TV_BOX_OTT', label: 'TV Box / ONN TV' },
            { id: 'CAMARA_SEGURIDAD_IOT', label: 'Cámaras Ezviz / IoT' },
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
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-500" />
                    Cargando catálogo maestro...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
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
                    <tr 
                      key={product.id} 
                      onClick={() => handleOpenDetail(product)}
                      className="hover:bg-sky-50/50 dark:hover:bg-slate-800/60 transition cursor-pointer group"
                    >
                      
                      {/* SKU */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-900/60 group-hover:border-sky-400 transition">
                          {product.sku}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition">
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

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(product)}
                            title="Ver Ficha de Stock & Trazabilidad"
                            className="p-1.5 rounded-lg text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleOpenEdit(product, e)}
                            title="Editar Información de Producto"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteProduct(product, e)}
                            title="Eliminar del Catálogo"
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: FICHA DE TRAZABILIDAD & STOCK DEL PRODUCTO ── */}
      {showDetailModal && selectedProductDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-6 my-6 max-h-[90vh] overflow-y-auto">
            
            {/* Header Ficha */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 mt-1">
                  <PackagePlus className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-900/60">
                      {selectedProductDetail.sku}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                      {formatCategoryName(selectedProductDetail.category)}
                    </span>
                    {getTrackingTypeBadge(selectedProductDetail.trackingType)}
                  </div>
                  <h3 className="font-heading font-bold text-xl text-slate-900 dark:text-white mt-1">
                    {selectedProductDetail.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedProductDetail.brand && <span className="font-semibold text-slate-700 dark:text-slate-300">Marca: {selectedProductDetail.brand}</span>}
                    {selectedProductDetail.model && <span className="ml-2 font-semibold text-slate-700 dark:text-slate-300">Modelo: {selectedProductDetail.model}</span>}
                    {selectedProductDetail.description && <span className="block mt-0.5">{selectedProductDetail.description}</span>}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(selectedProductDetail, { stopPropagation: () => {} } as any)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs font-semibold flex items-center gap-1.5"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="py-16 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                Consultando existencias y trazabilidad en tiempo real...
              </div>
            ) : (
              <>
                {/* ── 4 KPIs de Existencias ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                      <span className="text-[11px] font-bold uppercase">En Bodega Central</span>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-900 dark:text-emerald-200">
                      {selectedProductDetail.trackingType === 'SERIALIZED' 
                        ? countEnBodega 
                        : selectedProductDetail.trackingType === 'BATCHED'
                        ? detailBatches.filter(b => b.status === 'DISPONIBLE').reduce((acc, b) => acc + (b.currentQuantity || 0), 0) + ' m'
                        : detailBulk.reduce((acc, b) => acc + (b.quantity || 0), 0)
                      }
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Disponibles para despacho</p>
                  </div>

                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
                      <span className="text-[11px] font-bold uppercase">En Camionetas</span>
                      <Truck className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-200">
                      {selectedProductDetail.trackingType === 'SERIALIZED' ? countEnVehiculo : 0}
                    </div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Con técnicos en ruta</p>
                  </div>

                  <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1">
                      <span className="text-[11px] font-bold uppercase">Instalados en Clientes</span>
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-purple-900 dark:text-purple-200">
                      {selectedProductDetail.trackingType === 'SERIALIZED' ? countInstalado : 0}
                    </div>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">En comodato / servicio</p>
                  </div>

                  <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 p-4 rounded-2xl">
                    <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
                      <span className="text-[11px] font-bold uppercase">RMA / Defectuoso</span>
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div className="text-2xl font-bold font-mono text-rose-900 dark:text-rose-200">
                      {selectedProductDetail.trackingType === 'SERIALIZED' ? countRma : 0}
                    </div>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">En garantía / reparación</p>
                  </div>

                </div>

                {/* ── Sección de Control según Naturaleza ── */}
                {selectedProductDetail.trackingType === 'SERIALIZED' && (
                  <div className="space-y-3">
                    
                    {/* Filtros de la tabla de seriales */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                      
                      <div className="relative w-full sm:w-80">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Buscar por S/N, MAC, Código Verif. o Cliente..."
                          value={detailSearchQuery}
                          onChange={(e) => setDetailSearchQuery(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>

                      {/* Tabs de estado */}
                      <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-xs">
                        {[
                          { id: 'ALL', label: `Todos (${detailSerialized.length})` },
                          { id: 'EN_BODEGA', label: `En Bodega (${countEnBodega})` },
                          { id: 'EN_VEHICULO', label: `En Camioneta (${countEnVehiculo})` },
                          { id: 'INSTALADO_CLIENTE', label: `Instalado (${countInstalado})` },
                          { id: 'RMA_DEFECTUOSO', label: `RMA (${countRma})` }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setDetailStatusFilter(tab.id as any)}
                            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] whitespace-nowrap transition ${
                              detailStatusFilter === tab.id
                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                    </div>

                    {/* Tabla de Equipos Seriados */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold sticky top-0 uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3">Serial S/N</th>
                              <th className="py-2.5 px-3">MAC Address / Código</th>
                              <th className="py-2.5 px-3">Ubicación Actual</th>
                              <th className="py-2.5 px-3">Estado</th>
                              <th className="py-2.5 px-3">Cliente Asignado (Wispro)</th>
                              <th className="py-2.5 px-3 text-right">Fecha Registro</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {filteredDetailSerialized.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="text-center py-8 text-slate-400">
                                  No hay equipos que coincidan con los filtros seleccionados
                                </td>
                              </tr>
                            ) : (
                              filteredDetailSerialized.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                  
                                  {/* Serial */}
                                  <td className="py-2.5 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                                    {item.serialNumber}
                                  </td>

                                  {/* MAC & Código de Verificación Ezviz */}
                                  <td className="py-2.5 px-3">
                                    <div className="space-y-0.5 font-mono text-[11px]">
                                      {item.macAddress && (
                                        <div className="text-slate-700 dark:text-slate-300">
                                          MAC: <span className="font-semibold">{item.macAddress}</span>
                                        </div>
                                      )}
                                      {item.verificationCode && (
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px]">
                                          <Key className="w-2.5 h-2.5" />
                                          <span>Code: <strong>{item.verificationCode}</strong></span>
                                        </div>
                                      )}
                                      {!item.macAddress && !item.verificationCode && (
                                        <span className="text-slate-400 italic">—</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Ubicación */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {item.currentWarehouse?.name || item.currentWarehouseName || 'Sin asignar'}
                                    </div>
                                    {item.currentWarehouse?.vehiclePlate && (
                                      <span className="text-[10px] text-slate-400">
                                        Placa: {item.currentWarehouse.vehiclePlate}
                                      </span>
                                    )}
                                  </td>

                                  {/* Estado */}
                                  <td className="py-2.5 px-3">
                                    {getSerializedStatusBadge(item.status)}
                                  </td>

                                  {/* Cliente Wispro */}
                                  <td className="py-2.5 px-3">
                                    {item.installedClientName ? (
                                      <div>
                                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                          <UserCheck className="w-3 h-3 text-purple-500" />
                                          <span>{item.installedClientName}</span>
                                        </div>
                                        {item.installedContractId && (
                                          <span className="text-[10px] font-mono text-slate-400">
                                            Contrato: {item.installedContractId}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No instalado</span>
                                    )}
                                  </td>

                                  {/* Fecha */}
                                  <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400">
                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                                  </td>

                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

                {/* ── Sección de Lotes / Bobinas (BATCHED) ── */}
                {selectedProductDetail.trackingType === 'BATCHED' && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Lotes & Bobinas Registradas
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detailBatches.length === 0 ? (
                        <div className="col-span-2 text-center py-6 text-slate-400 border border-dashed rounded-xl">
                          No hay lotes ni bobinas registradas aún para este producto
                        </div>
                      ) : (
                        detailBatches.map(batch => {
                          const percentLeft = Math.round((batch.currentQuantity / (batch.initialQuantity || 1)) * 100);
                          return (
                            <div key={batch.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                  Lote #{batch.batchNumber}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                  {batch.currentWarehouse?.name || 'Bodega'}
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between text-xs font-semibold">
                                <span>Remanente: <strong className="text-slate-900 dark:text-white font-mono">{batch.currentQuantity} m</strong></span>
                                <span className="text-slate-400 text-[11px]">Inicial: {batch.initialQuantity} m</span>
                              </div>
                              {/* Barra de Progreso */}
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${percentLeft > 30 ? 'bg-emerald-500' : percentLeft > 10 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                  style={{ width: `${percentLeft}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* ── Sección Granel (BULK) ── */}
                {selectedProductDetail.trackingType === 'BULK' && (
                  <div className="space-y-3">
                    <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Existencias a Granel por Bodega / Vehículo
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {detailBulk.length === 0 ? (
                        <div className="col-span-3 text-center py-6 text-slate-400 border border-dashed rounded-xl">
                          No hay existencias a granel registradas
                        </div>
                      ) : (
                        detailBulk.map(b => (
                          <div key={b.id} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white text-xs">
                                {b.warehouseName || 'Bodega'}
                              </div>
                              <span className="text-[10px] text-slate-400">Almacén de Stock</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                                {b.quantity}
                              </span>
                              <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                                {b.unitOfMeasure}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition"
              >
                Cerrar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR PRODUCTO EN CATÁLOGO ── */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                    Editar Producto: {editingProduct.sku}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modifica los atributos maestros del material en catálogo
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              
              {/* Categoría */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Categoría del Material *
                </label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as ItemCategory })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-semibold text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="ONU_ONT">🔌 ONU / ONT (Terminal Óptico)</option>
                  <option value="ROUTER_WIFI">📶 Router WiFi / Access Point</option>
                  <option value="REPETIDOR_MESH">🌐 Repetidor WiFi / Nodo Mesh (Halo, Deco, TP-Link)</option>
                  <option value="TV_BOX_OTT">📺 TV Box / OTT (ONN TV 4K, Android TV, FireStick)</option>
                  <option value="CAMARA_SEGURIDAD_IOT">📷 Cámara de Seguridad / IoT (Ezviz, Tapo, Sensores)</option>
                  <option value="CABLE_DROP">🌀 Cable Drop (Bobinas / Fibra Óptica)</option>
                  <option value="CONECTORIZACION">🧩 Conectorización (SC/APC, Acopladores)</option>
                  <option value="HERRAJE_PLANTA_EXTERNA">🏗️ Herrajes, Tensores & Cajas NAP</option>
                  <option value="HERRAMIENTA_EQUIPO">🛠️ Herramientas & Equipos de Medición</option>
                  <option value="MISCELANEOS">📦 Consumibles y Misceláneos (MicroSD, Fuentes, Patchcords)</option>
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
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
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
                    value={editFormData.brand}
                    onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Modelo / Especificación
                  </label>
                  <input
                    type="text"
                    value={editFormData.model}
                    onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              {/* Unidad de Medida y Alerta de Stock Mínimo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={editFormData.unitOfMeasure}
                    onChange={(e) => setEditFormData({ ...editFormData, unitOfMeasure: e.target.value as UnitOfMeasure })}
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
                    value={editFormData.minStockAlert}
                    onChange={(e) => setEditFormData({ ...editFormData, minStockAlert: Number(e.target.value) || 0 })}
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
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                  <span>Guardar Cambios</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

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
                  <option value="ROUTER_WIFI">📶 Router WiFi / Access Point</option>
                  <option value="REPETIDOR_MESH">🌐 Repetidor WiFi / Nodo Mesh (Halo, Deco, TP-Link)</option>
                  <option value="TV_BOX_OTT">📺 TV Box / OTT (ONN TV 4K, Android TV, FireStick)</option>
                  <option value="CAMARA_SEGURIDAD_IOT">📷 Cámara de Seguridad / IoT (Ezviz, Tapo, Sensores)</option>
                  <option value="CABLE_DROP">🌀 Cable Drop (Bobinas / Fibra Óptica)</option>
                  <option value="CONECTORIZACION">🧩 Conectorización (SC/APC, Acopladores)</option>
                  <option value="HERRAJE_PLANTA_EXTERNA">🏗️ Herrajes, Tensores & Cajas NAP</option>
                  <option value="HERRAMIENTA_EQUIPO">🛠️ Herramientas & Equipos de Medición</option>
                  <option value="MISCELANEOS">📦 Consumibles y Misceláneos (MicroSD, Fuentes, Patchcords)</option>
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
                      Control por MAC/Serial único (ONUs, Routers, TV Box, Cámaras).
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
