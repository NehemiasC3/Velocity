import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Search, ShieldCheck, MapPin, Phone, Mail, 
  ChevronLeft, ChevronRight, X, Loader2, CheckCircle2, AlertTriangle, 
  FileText, Edit2, RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { Client } from '../../types';

export const ClientsPage: React.FC = () => {
  // Estado de lista y paginación
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [search, setSearch] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Estado del Modal (Crear / Editar)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    dni_passport: '',
    phone: '',
    email: '',
    address: ''
  });

  // Notificaciones Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar clientes con Server-Side Pagination
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getClients({ 
        page, 
        limit, 
        search: search.trim(),
        origin: originFilter !== 'ALL' ? originFilter : undefined
      });
      setClients(res.data || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error('Error al cargar clientes:', err);
      showToast(err.message || 'Error al conectar con el servidor de clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, originFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  // Manejador de apertura del modal
  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      dni_passport: '',
      phone: '',
      email: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      dni_passport: client.dniPassport || '',
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || ''
    });
    setIsModalOpen(true);
  };

  // Guardar cliente (POST o PUT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('El nombre del abonado es obligatorio', 'error');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, {
          name: formData.name.trim(),
          dniPassport: formData.dni_passport.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined
        });
        showToast('Cliente actualizado exitosamente');
      } else {
        await api.createClient({
          name: formData.name.trim(),
          dni_passport: formData.dni_passport.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          origin: 'VELOCITY'
        });
        showToast('Nuevo cliente registrado exitosamente');
      }
      setIsModalOpen(false);
      fetchClients();
    } catch (err: any) {
      console.error('Error guardando cliente:', err);
      showToast(err.message || 'Error al guardar cliente. Verifique los datos.', 'error');
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
          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Padrón de Abonados (BSS Core)</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Padrón oficial de abonados de fibra óptica de Velocity - Rappido Panama ISP.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchClients} 
            title="Refrescar abonados"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Abonado</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Clientes BSS</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{total}</p>
          <span className="text-xs text-blue-600 font-medium">Registrados en PostgreSQL</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Página Actual</p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{page} / {totalPages}</p>
          <span className="text-xs text-emerald-600 font-medium">{clients.length} abonados mostrados</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Límite por Página</p>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{limit}</p>
          <span className="text-xs text-indigo-600 font-medium">Server-Side Pagination</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Protección de Datos</p>
          <p className="text-2xl font-bold text-violet-600 mt-2">100%</p>
          <span className="text-xs text-violet-600 font-medium">Prisma Select Optimizado</span>
        </div>
      </div>

      {/* Buscador y Tabla */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Barra de Búsqueda en Tiempo Real */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por Nombre, Cédula/RUC, Teléfono o Email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
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
          <div className="flex items-center gap-3 w-full sm:w-auto">
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
              {clients.length} de {total}
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Abonado / Cliente</th>
                <th className="px-6 py-3.5">Cédula / RUC</th>
                <th className="px-6 py-3.5">Contacto</th>
                <th className="px-6 py-3.5">Dirección</th>
                <th className="px-6 py-3.5 text-center">Contratos</th>
                <th className="px-6 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                // Skeletons de Carga
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36 mb-2"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28 mb-1"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-36"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-44"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-8 mx-auto"></div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-16 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <ShieldCheck className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No se encontraron clientes</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search ? 'Intente con otro término de búsqueda' : 'Comience registrando el primer cliente'}
                    </p>
                    {!search && (
                      <button 
                        onClick={handleOpenCreate}
                        className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Registrar Cliente
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{client.name}</span>
                        {client.origin === 'WISPRO' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            WISPRO
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            VELOCITY
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">ID: {client.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {client.dniPassport || <span className="text-slate-400 italic">Sin Cédula</span>}
                    </td>
                    <td className="px-6 py-4">
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {!client.phone && !client.email && <span className="text-xs text-slate-400 italic">Sin datos</span>}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-600 dark:text-slate-400">
                      {client.address ? (
                        <div className="flex items-center gap-1.5" title={client.address}>
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No especificada</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        (client._count?.contracts ?? 0) > 0
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {client._count?.contracts ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(client)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Server-Side */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Página {page} de {totalPages} ({total} abonados totales)
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

      {/* Modal Dialog Form (Crear / Editar Cliente) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                  {editingClient ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {editingClient ? 'Actualizar Datos del Abonado' : 'Nuevo Abonado de Fibra Óptica'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingClient ? 'Modificar datos personales o dirección de instalación' : 'Registrar nuevo abonado en la base de datos central'}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Nombre Completo / Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej. Juan Carlos Pérez o Corporación ABC"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Cédula / RUC / Pasaporte
                  </label>
                  <input
                    type="text"
                    value={formData.dni_passport}
                    onChange={(e) => setFormData({ ...formData, dni_passport: e.target.value })}
                    placeholder="ej. 8-888-888"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="ej. +507 6000-0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ej. cliente@ejemplo.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Dirección de Instalación / Domicilio
                </label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="ej. Calle 5ta, Casa #24, Barrio El Trébol"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white resize-none"
                />
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingClient ? 'Actualizar Abonado' : 'Guardar Abonado'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
