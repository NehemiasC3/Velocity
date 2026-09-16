import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Plus, Search, Filter, CheckCircle2, AlertCircle, Clock, 
  ChevronLeft, ChevronRight, X, Loader2, AlertTriangle, RefreshCw, 
  Wifi, Globe, UserCheck, Edit3
} from 'lucide-react';
import { api } from '../../services/api';
import { Contract, Client, ServicePlan } from '../../types';

export const ContractsPage: React.FC = () => {
  // Estados de lista y paginación
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [originFilter, setOriginFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Estados del modal y formularios
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Datos para selectores dinámicos
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [plansList, setPlansList] = useState<ServicePlan[]>([]);
  const [loadingSelects, setLoadingSelects] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    clientId: '',
    servicePlanId: '',
    ip_address: '',
    status: 'ACTIVO'
  });

  // Notificaciones Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Cargar contratos paginados
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getContracts({
        page,
        limit,
        search: search.trim(),
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        origin: originFilter !== 'ALL' ? originFilter : undefined
      });
      setContracts(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error('Error al cargar contratos:', err);
      showToast(err.message || 'Error al consultar contratos', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, originFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContracts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchContracts]);

  // Cargar clientes y planes para los selectores dinámicos del modal
  const loadSelectData = async () => {
    setLoadingSelects(true);
    try {
      const [clientsRes, plansRes] = await Promise.all([
        api.getClients({ limit: 100 }),
        api.getPlans()
      ]);
      setClientsList(clientsRes.data || []);
      setPlansList(plansRes.data || []);
    } catch (err: any) {
      console.error('Error cargando listas de clientes o planes:', err);
      showToast('Error cargando catálogo de planes o clientes', 'error');
    } finally {
      setLoadingSelects(false);
    }
  };

  // Abrir Modal para Nuevo Contrato
  const handleOpenCreate = () => {
    setEditingContract(null);
    setFormData({
      clientId: '',
      servicePlanId: '',
      ip_address: '',
      status: 'ACTIVO'
    });
    setIsModalOpen(true);
    loadSelectData();
  };

  // Abrir Modal para Editar Contrato
  const handleOpenEdit = (contract: Contract) => {
    setEditingContract(contract);
    setFormData({
      clientId: contract.clientId || '',
      servicePlanId: contract.servicePlanId || '',
      ip_address: contract.ipAddress || '',
      status: contract.status || 'ACTIVO'
    });
    setIsModalOpen(true);
    loadSelectData();
  };

  // Enviar formulario (POST / PUT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      showToast('Debe seleccionar un Cliente para el contrato', 'error');
      return;
    }

    if (formData.ip_address.trim()) {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(formData.ip_address.trim())) {
        showToast(`La dirección IP "${formData.ip_address.trim()}" no tiene un formato IPv4 válido (ej. 192.168.10.45)`, 'error');
        return;
      }
    }

    setFormSubmitting(true);
    try {
      if (editingContract) {
        await api.updateContract(editingContract.id, {
          clientId: formData.clientId,
          servicePlanId: formData.servicePlanId || undefined,
          ip_address: formData.ip_address.trim() || undefined,
          status: formData.status
        });
        showToast('Contrato actualizado exitosamente');
      } else {
        await api.createContract({
          clientId: formData.clientId,
          servicePlanId: formData.servicePlanId || undefined,
          ip_address: formData.ip_address.trim() || undefined,
          status: formData.status,
          origin: 'VELOCITY'
        });
        showToast('Contrato emitido exitosamente con IP y plan asignados');
      }
      setIsModalOpen(false);
      fetchContracts();
    } catch (err: any) {
      console.error('Error guardando contrato:', err);
      // Mensajes específicos amigables para condiciones de carrera o conflictos
      const errorMsg = err.message || 'Error al guardar contrato';
      showToast(errorMsg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-bounce">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contratos de Servicio (BSS Core)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestión oficial de contratos de fibra óptica, direccionamiento IP y planes de velocidad para Rappido Panama ISP.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchContracts} 
            title="Refrescar contratos"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Contrato</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Contratos</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Página Actual</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{page} / {totalPages}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Control de Concurrencia</p>
            <p className="text-xl font-bold text-indigo-600 mt-1">Prisma $transaction</p>
          </div>
        </div>
      </div>

      {/* Tabla y Filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Barra de Búsqueda y Filtros de Estado */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por número de contrato, IP o cliente..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
            />
            {search && (
              <button 
                onClick={() => { setSearch(''); setPage(1); }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVO">ACTIVO</option>
              <option value="SUSPENDIDO">SUSPENDIDO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => {
                setOriginFilter(e.target.value);
                setPage(1);
              }}
              className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">Todos los Orígenes</option>
              <option value="VELOCITY">VELOCITY (Nativo)</option>
              <option value="WISPRO">WISPRO (Migrado)</option>
            </select>

            <div className="text-xs text-slate-500 hidden sm:block">
              {contracts.length} de {total}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Contrato</th>
                <th className="px-6 py-3.5">Abonado / Cliente</th>
                <th className="px-6 py-3.5">Plan de Servicio</th>
                <th className="px-6 py-3.5">Dirección IP Asignada</th>
                <th className="px-6 py-3.5 text-center">Estado</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                // Skeletons de Carga
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28 mb-1"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-16"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36 mb-1"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-16 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No se encontraron contratos</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search ? 'Intente ajustando los filtros de búsqueda' : 'Emita un nuevo contrato para comenzar'}
                    </p>
                    {!search && (
                      <button 
                        onClick={handleOpenCreate}
                        className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Emitir Contrato
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-slate-900 dark:text-white">
                          {contract.contractNumber || 'SIN NUMERO'}
                        </span>
                        {contract.origin === 'WISPRO' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            WISPRO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                            VELOCITY
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {contract.client?.name || <span className="text-rose-500">Cliente Desconocido</span>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {contract.client?.dniPassport || contract.client?.phone || 'Sin datos extra'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {contract.servicePlan ? (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {contract.servicePlan.name}
                          </div>
                          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <Wifi className="w-3 h-3" />
                            <span>{contract.servicePlan.downloadSpeed}M / {contract.servicePlan.uploadSpeed}M</span>
                            <span className="text-slate-400 font-normal">(${contract.servicePlan.price})</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Plan no asignado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {contract.ipAddress ? (
                        <span className="font-mono text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {contract.ipAddress}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">DHCP Dinámico</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        contract.status === 'ACTIVO'
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : contract.status === 'SUSPENDIDO'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                      }`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(contract)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Página {page} de {totalPages} ({total} contratos totales)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Dialog Form (Nuevo / Editar Contrato) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
                  {editingContract ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {editingContract ? `Actualizar Contrato ${editingContract.contractNumber || ''}` : 'Nuevo Contrato de Servicio'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingContract ? 'Modificar plan de velocidad o dirección IP asignada' : 'Vincular abonado con plan de velocidad y dirección IP de instalación'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Selector de Cliente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Abonado / Titular del Servicio <span className="text-rose-500">*</span>
                </label>
                {loadingSelects ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Cargando padrón de abonados...</span>
                  </div>
                ) : clientsList.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-center justify-between">
                    <span>No hay clientes registrados en el sistema.</span>
                  </div>
                ) : (
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Seleccione un Abonado ({clientsList.length} disponibles) --</option>
                    {clientsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.origin || 'VELOCITY'}] {c.name} {c.dniPassport ? `(${c.dniPassport})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Selector de Plan de Servicio */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Plan de Velocidad & Tarifa
                </label>
                {loadingSelects ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2.5 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span>Cargando planes de velocidad...</span>
                  </div>
                ) : plansList.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-xl text-xs">
                    <span>No hay planes de velocidad creados. Puede crear uno en el módulo de Planes.</span>
                  </div>
                ) : (
                  <select
                    value={formData.servicePlanId}
                    onChange={(e) => setFormData({ ...formData, servicePlanId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Sin Plan Asignado --</option>
                    {plansList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.downloadSpeed}M Down / {p.uploadSpeed}M Up (${Number(p.price).toFixed(2)}/mes)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Input Dirección IP y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Dirección IP (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    placeholder="ej. 192.168.10.45"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Validación estricta de colisión IPv4
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Estado del Contrato
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="SUSPENDIDO">SUSPENDIDO</option>
                    <option value="CANCELADO">CANCELADO</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingContract ? 'Actualizar Contrato' : 'Emitir Contrato'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
