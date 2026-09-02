import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Fuse, { IFuseOptions } from 'fuse.js';
import { InventoryItem, InventoryApiResponse, UseInventorySearchResult } from '../types/inventory';

const STORAGE_CACHE_KEY = 'velocity_inventory_cache_v2';
const STORAGE_META_KEY = 'velocity_inventory_meta_v2';

const FUSE_OPTIONS: IFuseOptions<InventoryItem> = {
  keys: [
    { name: 'client_name', weight: 0.35 },
    { name: 'ip', weight: 0.25 },
    { name: 'mac', weight: 0.2 },
    { name: 'serial_number', weight: 0.15 },
    { name: 'model', weight: 0.05 }
  ],
  threshold: 0.3,
  ignoreLocation: true,
  useExtendedSearch: false,
  minMatchCharLength: 1
};

/**
 * Carga inicial síncrona desde localStorage para renderizado en 0ms
 */
function getInitialCachedData(): { items: InventoryItem[]; lastUpdated: string | null } {
  try {
    const rawData = localStorage.getItem(STORAGE_CACHE_KEY);
    const rawMeta = localStorage.getItem(STORAGE_META_KEY);
    if (rawData) {
      const items = JSON.parse(rawData);
      if (Array.isArray(items) && items.length > 0) {
        return { items, lastUpdated: rawMeta || null };
      }
    }
  } catch {
    // Si hay error en parseo, continuar con array vacío
  }
  return { items: [], lastUpdated: null };
}

/**
 * Custom Hook con patrón Stale-While-Revalidate (SWR) y Fuse.js.
 * Al presionar F5 o montar el componente, renderiza inmediatamente desde la caché local (< 5ms)
 * y actualiza silenciosamente en segundo plano sin congelar la pantalla.
 */
export function useInventorySearch(apiUrl: string = '/api/v1/inventory'): UseInventorySearchResult {
  const initialCache = useMemo(() => getInitialCachedData(), []);

  // Si ya tenemos datos en caché local, la carga inicial es 0ms (loading = false)
  const [data, setData] = useState<InventoryItem[]>(initialCache.items);
  const [loading, setLoading] = useState<boolean>(initialCache.items.length === 0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCached, setIsCached] = useState<boolean>(initialCache.items.length > 0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialCache.lastUpdated);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Sincronización Stale-While-Revalidate en segundo plano
   */
  const fetchData = useCallback(
    async (forceRefresh = false) => {
      // Solo mostrar spinner bloqueante si no tenemos NADA de datos aún
      if (data.length === 0 || forceRefresh) {
        setLoading(true);
      }
      setIsSyncing(true);
      setError(null);

      try {
        const url = forceRefresh ? `${apiUrl}?force=true` : apiUrl;
        const response = await fetch(url, {
          headers: {
            Accept: 'application/json'
          }
        });

        // Manejo de 304 Not Modified
        if (response.status === 304) {
          if (isMounted.current) {
            setIsCached(true);
            setLoading(false);
            setIsSyncing(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Error en el servidor: HTTP ${response.status}`);
        }

        const json: InventoryApiResponse = await response.json();

        if (json.success && Array.isArray(json.data) && isMounted.current) {
          setData(json.data);
          setIsCached(Boolean(json.cached));
          const timestamp = json.timestamp || new Date().toISOString();
          setLastUpdated(timestamp);

          // Guardar en caché persistente local de forma asíncrona no bloqueante
          setTimeout(() => {
            try {
              localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(json.data));
              localStorage.setItem(STORAGE_META_KEY, timestamp);
            } catch (e) {
              console.warn('[useInventorySearch] Quota de localStorage excedida para caché persistente:', e);
            }
          }, 50);
        }
      } catch (err: any) {
        console.warn('[useInventorySearch] Error en sincronización de fondo:', err.message);
        // Si no tenemos ningún dato local, mostramos el error
        if (data.length === 0 && isMounted.current) {
          setError(err.message || 'No se pudo conectar con el servidor de inventario');
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setIsSyncing(false);
        }
      }
    },
    [apiUrl, data.length]
  );

  // Sincronización al montar (en segundo plano si ya había datos)
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Inicializar el índice Fuse.js en memoria
   */
  const fuse = useMemo(() => {
    return new Fuse(data, FUSE_OPTIONS);
  }, [data]);

  /**
   * Búsqueda en memoria con latencia 0ms
   */
  const results = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      return data;
    }

    const fuseResults = fuse.search(trimmed);
    return fuseResults.map((res) => res.item);
  }, [fuse, searchTerm, data]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    loading,
    error,
    searchTerm,
    setSearchTerm,
    results,
    totalRecords: data.length,
    refresh,
    isCached,
    lastUpdated,
    isSyncing
  } as UseInventorySearchResult & { isSyncing: boolean };
}
