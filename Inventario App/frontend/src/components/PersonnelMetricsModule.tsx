import React, { useEffect, useState } from 'react';
import { 
  Users, AlertTriangle, TrendingUp, CheckCircle, 
  BarChart3, Activity, ShieldAlert, Award, ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import { TechnicianMetric, InstallationTicket } from '../types';

export const PersonnelMetricsModule: React.FC = () => {
  const [metrics, setMetrics] = useState<TechnicianMetric[]>([]);
  const [tickets, setTickets] = useState<InstallationTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metRes, tckRes] = await Promise.all([
        api.getPersonnelMetrics(),
        api.getTickets()
      ]);
      setMetrics(metRes.metrics);
      setTickets(tckRes.tickets);
    } catch (err) {
      console.error('Error cargando métricas de personal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-sky-500" />
          <span>Rendimiento de Cuadrillas & Auditoría de Mermas</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Supervisión de consumo de cable Drop por técnico para detectar posibles sobrecostos, desviaciones o robos de material.
        </p>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metrics.map((m) => (
          <div 
            key={m.technicianId}
            className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm space-y-4 transition ${
              m.isAnomaly 
                ? 'border-rose-400 dark:border-rose-800 ring-2 ring-rose-500/10' 
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                    {m.technicianName}
                  </h3>
                  {m.isAnomaly ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Alerta Desvío
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Consumo Normal
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Asignado a: {m.assignedWarehouse}</p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-heading font-extrabold text-slate-900 dark:text-white font-mono">
                  {m.avgMetersPerInstall}m
                </span>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Promedio / Inst.</p>
              </div>
            </div>

            {/* Warning alert if anomaly */}
            {m.isAnomaly && m.anomalyWarning && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p>{m.anomalyWarning}</p>
              </div>
            )}

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Instalaciones</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">{m.totalInstalls}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Total Drop</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">{m.totalMetersConsumed}m</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                <span className="text-slate-400 block text-[10px]">Conectores</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-sm">{m.totalConnectorsUsed}</span>
              </div>
            </div>

            {/* Consumption Bar Indicator against 110m benchmark */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Rendimiento vs Umbral Estándar (110m max)</span>
                <span className="font-semibold">{Math.round((m.avgMetersPerInstall / 110) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${m.isAnomaly ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min((m.avgMetersPerInstall / 150) * 100, 100)}%` }}
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* Installation Tickets History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-500" />
          <span>Historial de Instalaciones y Materiales Descargados</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Cliente Wispro</th>
                <th className="py-3 px-4">Técnico Instalador</th>
                <th className="py-3 px-4">ONU Instalada</th>
                <th className="py-3 px-4">Drop Utilizado</th>
                <th className="py-3 px-4">Conectores / Tensores</th>
                <th className="py-3 px-4 text-right">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {tickets.map((tck) => (
                <tr key={tck.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                    {tck.ticketNumber}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 dark:text-white">{tck.wisproClientName}</span>
                    <span className="block text-[11px] text-slate-400">{tck.clientAddress}</span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {tck.technicianName}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    {tck.installedOnuMac || 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`font-mono font-bold ${
                      tck.cableDropMetersUsed > 110 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                    }`}>
                      {tck.cableDropMetersUsed} metros
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    {tck.connectorsUsed} conectores, {tck.tensorsUsed} tensores
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                    {new Date(tck.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
