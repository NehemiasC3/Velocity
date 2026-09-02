import React, { useEffect, useState } from 'react';
import { 
  Wifi, RefreshCw, CheckCircle2, Shield, 
  ExternalLink, Server, Globe, Key, Code2, Play
} from 'lucide-react';
import { api } from '../services/api';
import { WisproClient } from '../types';

export const WisproModule: React.FC = () => {
  const [clients, setClients] = useState<WisproClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Sandbox simulation
  const [simContractId, setSimContractId] = useState('CTR-99011');
  const [simMac, setSimMac] = useState('F4:8E:38:1A:4C:90');
  const [simResponse, setSimResponse] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getWisproClients();
      setClients(res.clients);
    } catch (err) {
      console.error('Error cargando clientes de Wispro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualSync = async () => {
    try {
      setSyncing(true);
      const res = await api.syncWispro();
      setSyncMessage(res.message);
      loadData();
      setTimeout(() => setSyncMessage(null), 6000);
    } catch (err: any) {
      setSyncMessage(`Error sincronizando: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleRunSimulatedCall = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setSimResponse({
        http_status: 200,
        wispro_api_endpoint: `PUT https://cloud.wispro.co/api/v1/contracts/${simContractId}`,
        request_headers: {
          'Authorization': 'Bearer wisp_live_demo_token_sec_99a8b7c6d5e4',
          'Content-Type': 'application/json'
        },
        payload_sent: {
          technical_data: {
            onu_mac_address: simMac,
            equipment_type: 'ONU_GPON',
            auto_provision_olt: true
          }
        },
        wispro_cloud_response: {
          status: 'success',
          contract_id: simContractId,
          service_state: 'ACTIVE',
          olt_port_state: 'AUTHENTICATED',
          rx_optical_power: '-19.4 dBm',
          message: 'ONU authorized and binded to customer contract in Wispro.'
        }
      });
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 rounded-2xl p-6 text-white border border-sky-900/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> API REST Bidireccional
            </span>
            <span className="text-xs text-slate-400">Wispro Cloud ISP Manager</span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-white">
            Integración Wispro: Clientes & Aprovisionamiento
          </h2>
          <p className="text-xs text-slate-300">
            Sincronización automática de contratos y clientes, con inyección atómica de la MAC de la ONU al cerrar la instalación.
          </p>
        </div>

        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition shadow-lg flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar con Wispro Ahora'}</span>
        </button>
      </div>

      {syncMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Grid: Clients List + API Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Synchronized Clients Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-500" />
              <span>Base de Clientes & Contratos en Wispro ({clients.length})</span>
            </h3>
            <span className="text-xs text-slate-400">GET /api/v1/clients</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Contrato</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Nodo OLT</th>
                  <th className="py-3 px-4">ONU MAC</th>
                  <th className="py-3 px-4 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                      {c.contractId}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-white">{c.name}</span>
                      <span className="block text-[11px] text-slate-400">{c.address}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {c.planName}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {c.nodeName}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {c.currentOnuMac ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{c.currentOnuMac}</span>
                      ) : (
                        <span className="text-amber-500 italic">Pendiente de ONU</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'ACTIVO'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Interactive API REST Simulator */}
        <div className="lg:col-span-1 bg-slate-900 rounded-2xl border border-slate-800 p-5 text-white shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-400" />
              <span>Simulador de Payload API Wispro</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              PUT /contracts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Contrato Objetivo</label>
              <select
                value={simContractId}
                onChange={(e) => setSimContractId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.contractId}>{c.contractId} ({c.name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">ONU MAC a Inyectar</label>
              <input
                type="text"
                value={simMac}
                onChange={(e) => setSimMac(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sky-400 font-mono font-bold"
              />
            </div>

            <button
              onClick={handleRunSimulatedCall}
              disabled={isSimulating}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Llamando a Wispro Cloud...' : 'Ejecutar Petición API'}</span>
            </button>
          </div>

          {/* JSON Response View */}
          {simResponse && (
            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Respuesta HTTP 200 OK</span>
                <span className="text-emerald-400 font-mono font-bold">Wispro Cloud</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-56 scrollbar-none border border-slate-800">
                {JSON.stringify(simResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
