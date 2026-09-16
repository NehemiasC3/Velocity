import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, Plus, ArrowDown, ArrowUp, DollarSign, Edit2, Trash2, 
  X, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Layers, 
  Activity, ShieldCheck, HelpCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { ServicePlan } from '../../types';

export const PlansPage: React.FC = () => {
  // Estado de lista y carga
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    download_speed: 100,
    upload_speed: 50,
    price: 25.00
  });

  // Modal Confirmar Eliminación
  const [deletingPlan, setDeletingPlan] = useState<ServicePlan | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);

  // Toast Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Cargar lista de planes desde el backend
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPlans();
      setPlans(res.data || []);
    } catch (err: any) {
      console.error('Error al cargar planes de servicio:', err);
      showToast(err.message || 'Error al conectar con el servidor de planes', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Manejo de Modal
  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      download_speed: 100,
      upload_speed: 50,
      price: 25.00
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (plan: ServicePlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      download_speed: plan.downloadSpeed,
      upload_speed: plan.uploadSpeed,
      price: typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price
    });
    setIsModalOpen(true);
  };

  const handleOpenDelete = (plan: ServicePlan) => {
    setDeletingPlan(plan);
    setIsDeleteModalOpen(true);
  };

  // Asignar simetría en formulario
  const handleSetSymmetric = () => {
    setFormData((prev) => ({
      ...prev,
      upload_speed: prev.download_speed
    }));
  };

  // Enviar formulario (Crear / Actualizar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones de negocio
    if (!formData.name.trim()) {
      showToast('El nombre del plan de servicio es obligatorio', 'error');
      return;
    }
    if (formData.download_speed <= 0) {
      showToast('La velocidad de bajada debe ser mayor a 0 Mbps', 'error');
      return;
    }
    if (formData.upload_speed <= 0) {
      showToast('La velocidad de subida debe ser mayor a 0 Mbps', 'error');
      return;
    }
    if (formData.price < 0) {
      showToast('El precio no puede ser negativo', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingPlan) {
        await api.updatePlan(editingPlan.id, {
          name: formData.name.trim(),
          downloadSpeed: Number(formData.download_speed),
          uploadSpeed: Number(formData.upload_speed),
          price: Number(formData.price)
        });
        showToast(`Plan "${formData.name.trim()}" actualizado exitosamente`);
      } else {
        await api.createPlan({
          name: formData.name.trim(),
          downloadSpeed: Number(formData.download_speed),
          uploadSpeed: Number(formData.upload_speed),
          price: Number(formData.price)
        });
        showToast(`Nuevo plan "${formData.name.trim()}" creado exitosamente`);
      }
      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      console.error('Error al guardar plan:', err);
      showToast(err.message || 'Error al guardar el plan de servicio', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!deletingPlan) return;

    // Advertencia previa si tiene contratos activos
    const contractsCount = deletingPlan._count?.contracts ?? 0;
    if (contractsCount > 0) {
      showToast(
        `Imposible eliminar: El plan tiene ${contractsCount} contrato(s) asociado(s). Reasigne los contratos primero.`,
        'error'
      );
      setIsDeleteModalOpen(false);
      return;
    }

    setDeleteSubmitting(true);
    try {
      await api.deletePlan(deletingPlan.id);
      showToast(`Plan "${deletingPlan.name}" eliminado correctamente`);
      setIsDeleteModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      console.error('Error al eliminar plan:', err);
      showToast(err.message || 'Error al eliminar el plan', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Estadísticas KPI calculadas
  const totalPlans = plans.length;
  const maxSpeedPlan = plans.length > 0 
    ? [...plans].sort((a, b) => b.downloadSpeed - a.downloadSpeed)[0] 
    : null;
  const cheapestPlan = plans.length > 0 
    ? [...plans].sort((a, b) => Number(a.price) - Number(b.price))[0] 
    : null;

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
            <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planes de Velocidad & Tarifas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestión de anchos de banda, simetría de fibra óptica y asignación comercial a contratos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchPlans}
            title="Refrescar planes"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nuevo Plan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Planes Activos</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalPlans}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan Mayor Velocidad</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {maxSpeedPlan ? `${maxSpeedPlan.downloadSpeed} Mbps` : 'N/A'}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[180px]">{maxSpeedPlan?.name || 'Sin planes'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarifa Más Accesible</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {cheapestPlan ? `$${Number(cheapestPlan.price).toFixed(2)}/mes` : 'N/A'}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-[180px]">{cheapestPlan?.name || 'Sin planes'}</p>
          </div>
        </div>
      </div>

      {/* Planes Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Nombre del Plan</th>
                <th className="px-6 py-4">Velocidad Bajada</th>
                <th className="px-6 py-4">Velocidad Subida</th>
                <th className="px-6 py-4">Tipo de Enlace</th>
                <th className="px-6 py-4">Tarifa Mensual</th>
                <th className="px-6 py-4">Contratos Asignados</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                      <p className="text-sm">Cargando planes de servicio...</p>
                    </div>
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Zap className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No hay planes registrados</p>
                      <p className="text-xs">Crea el primer plan de servicio haciendo clic en "Crear Nuevo Plan".</p>
                    </div>
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const isSymmetric = plan.downloadSpeed === plan.uploadSpeed;
                  const contractsCount = plan._count?.contracts ?? 0;
                  const priceFormatted = Number(plan.price).toFixed(2);

                  return (
                    <tr key={plan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                            <Zap className="w-4 h-4" />
                          </div>
                          <span>{plan.name}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                          <ArrowDown className="w-4 h-4" />
                          <span>{plan.downloadSpeed} Mbps</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                          <ArrowUp className="w-4 h-4" />
                          <span>{plan.uploadSpeed} Mbps</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isSymmetric ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            Simétrico 1:1
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Asimétrico
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          ${priceFormatted}
                        </span>
                        <span className="text-xs text-slate-400"> /mes</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          contractsCount > 0 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {contractsCount} {contractsCount === 1 ? 'contrato' : 'contratos'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(plan)}
                          title="Editar Plan"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(plan)}
                          title="Eliminar Plan"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog Form (Crear / Editar Plan) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                  {editingPlan ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {editingPlan ? 'Editar Plan de Servicio' : 'Nuevo Plan de Velocidad'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Definir anchos de banda para cola MikroTik y costo mensual
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre del Plan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nombre Comercial del Plan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Fibra 200M Simétrica"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white"
                />
              </div>

              {/* Velocidades de Bajada y Subida */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Bajada (Mbps) <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.download_speed}
                    onChange={(e) => setFormData({ ...formData, download_speed: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                    <ArrowUp className="w-3.5 h-3.5 text-blue-500" />
                    <span>Subida (Mbps) <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.upload_speed}
                    onChange={(e) => setFormData({ ...formData, upload_speed: Math.max(1, parseInt(e.target.value) || 0) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {/* Botón rápido de simetría */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSetSymmetric}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                >
                  ⚡ Hacer simétrico ({formData.download_speed}M / {formData.download_speed}M)
                </button>
              </div>

              {/* Precio Mensual */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Precio Mensual ($ USD) <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingPlan ? 'Guardar Cambios' : 'Crear Plan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {isDeleteModalOpen && deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  ¿Eliminar Plan de Servicio?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p><strong className="text-slate-900 dark:text-white">Plan:</strong> {deletingPlan.name}</p>
              <p><strong className="text-slate-900 dark:text-white">Velocidad:</strong> {deletingPlan.downloadSpeed}M Down / {deletingPlan.uploadSpeed}M Up</p>
              <p><strong className="text-slate-900 dark:text-white">Tarifa:</strong> ${Number(deletingPlan.price).toFixed(2)}/mes</p>
              <p>
                <strong className="text-slate-900 dark:text-white">Contratos vinculados:</strong>{' '}
                <span className={`font-semibold ${
                  (deletingPlan._count?.contracts ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}>
                  {deletingPlan._count?.contracts ?? 0}
                </span>
              </p>
            </div>

            {(deletingPlan._count?.contracts ?? 0) > 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-xl text-xs">
                ⚠️ Este plan tiene contratos vigentes. Por seguridad del ISP y para evitar pérdidas de datos, no puede eliminarse hasta que dichos contratos sean migrados a otro plan.
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting || (deletingPlan._count?.contracts ?? 0) > 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {deleteSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
