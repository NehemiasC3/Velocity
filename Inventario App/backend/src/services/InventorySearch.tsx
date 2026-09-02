import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { api } from '../services/api';
import { Search, Loader, ServerCrash, Wifi, WifiOff, User, MapPin } from 'lucide-react';

// Tipado para los items de inventario que vienen del backend
interface InventoryItem {
  id: string;
  client_name: string;
  ip: string;
  mac: string;
  address: string;
  status: string;
}

const useInventorySearch = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // 1. Fetch de datos al montar el componente
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const data = await api.getFullInventory();
        setInventory(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  // 2. Inicialización de Fuse.js
  const fuse = useMemo(() => new Fuse(inventory, {
    keys: ['client_name', 'ip', 'mac', 'address'],
    threshold: 0.3, // Búsqueda flexible
    includeScore: true,
  }), [inventory]);

  // 3. Resultados filtrados
  const results = useMemo(() => {
    if (!searchTerm) return inventory.slice(0, 50); // Muestra los primeros 50 si no hay búsqueda
    return fuse.search(searchTerm).map(result => result.item);
  }, [searchTerm, inventory, fuse]);

  return { loading, error, searchTerm, setSearchTerm, results };
};

export const InventorySearch: React.FC = () => {
  const { loading, error, searchTerm, setSearchTerm, results } = useInventorySearch();

  const getStatusChip = (status: string) => {
    const is_active = status.toLowerCase() === 'activo';
    return (
      <span className={`inline-flex items-center gap-1.5 py-1 px-2 rounded-full text-xs font-medium ${is_active ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
        {is_active ? <Wifi className="h-3 w-3"/> : <WifiOff className="h-3 w-3"/>}
        {status}
      </span>
    );
  }

  return (
    <div className="p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar cliente, IP, MAC o dirección..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none transition"
        />
      </div>

      {loading && <div className="flex justify-center items-center gap-2 text-sky-400 py-8"><Loader className="animate-spin" /> Cargando inventario de Wispro...</div>}
      {error && <div className="flex justify-center items-center gap-2 text-red-400 py-8"><ServerCrash /> Error: {error}</div>}
      
      {!loading && !error && (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {results.map((item) => (
            <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 hover:bg-slate-800 transition-colors">
              <div className="flex justify-between items-start">
                <div className="font-bold text-sky-400 flex items-center gap-2"><User className="w-4 h-4" />{item.client_name}</div>
                {getStatusChip(item.status)}
              </div>
              <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                <p className="font-mono"><strong>IP:</strong> {item.ip} | <strong>MAC:</strong> {item.mac}</p>
                <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {item.address}</p>
              </div>
            </div>
          ))}
           {results.length === 0 && <p className="text-center text-slate-500 py-6">No se encontraron resultados para "{searchTerm}".</p>}
        </div>
      )}
    </div>
  );
};