import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, X, Camera, Copy, Check, ExternalLink, ShieldCheck, 
  Boxes, Truck, Wifi, User, AlertCircle, ArrowRight, Loader2,
  Sparkles, CornerDownLeft, Tag, Layers, Clock
} from 'lucide-react';
import { api } from '../services/api';
import { UniversalSearchResults } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string, param?: string) => void;
}

type SearchCategory = 'ALL' | 'SERIALIZED' | 'BULK' | 'CLIENTS' | 'TRANSFERS' | 'AUDIT';

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('ALL');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<UniversalSearchResults | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener handled by parent or window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Parent handles opening or we trigger custom event
          window.dispatchEvent(new CustomEvent('toggle-command-palette'));
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced Universal Search
  const performSearch = useCallback(async (searchQuery: string, searchCategory: SearchCategory) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.universalSearch(trimmed, searchCategory);
      setResults(data);
    } catch (err) {
      console.error('[CommandPalette] Error en búsqueda universal:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query, category);
      } else {
        setResults(null);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query, category, performSearch]);

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleBarcodeScan = (scannedValue: string) => {
    setQuery(scannedValue);
    performSearch(scannedValue, category);
  };

  const getStatusBadge = (status: string) => {
    const st = status.toUpperCase();
    if (st.includes('BODEGA')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">EN BODEGA</span>;
    }
    if (st.includes('CLIENTE') || st.includes('INSTALADO')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">INSTALADO CLIENTE</span>;
    }
    if (st.includes('VEHICULO') || st.includes('TRANSITO')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">EN VEHÍCULO</span>;
    }
    if (st.includes('RMA') || st.includes('DEFECTUOSO') || st.includes('BAJA')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">RMA / DEFECTO</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">{status}</span>;
  };

  if (!isOpen) return null;

  const categories = [
    { id: 'ALL' as SearchCategory, label: '⚡ Todos' },
    { id: 'SERIALIZED' as SearchCategory, label: '📦 Equipos / ONUs' },
    { id: 'BULK' as SearchCategory, label: '🧵 Materiales & Bobinas' },
    { id: 'CLIENTS' as SearchCategory, label: '👤 Clientes Wispro' },
    { id: 'TRANSFERS' as SearchCategory, label: '🚚 Traslados' },
    { id: 'AUDIT' as SearchCategory, label: '🛡️ Trazabilidad Forense' }
  ];

  const hasResults = results && results.totalResults > 0;
  const showEmptyState = !loading && query.trim().length >= 2 && results && results.totalResults === 0;

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-10 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div 
          className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-sky-950/40 overflow-hidden flex flex-col my-auto max-h-[88vh]"
          onClick={(e) => e.stopPropagation()}
        >
          
          {/* Top Search Input Box */}
          <div className="relative flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-900/95">
            <Search className="w-5 h-5 text-sky-400 shrink-0 mr-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por MAC (ej: E0:67:B3 o sin puntos), Serial, Cliente Wispro, SKU, Remisión..."
              className="flex-1 bg-transparent text-sm md:text-base text-white placeholder-slate-500 focus:outline-none font-sans"
            />

            {/* Clear Button */}
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition mr-2"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition shrink-0 mr-2"
              title="Escanear Código de Barras o QR con la cámara"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Escanear</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Cerrar (Esc)"
            >
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">
                ESC
              </kbd>
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  category === cat.id
                    ? 'bg-sky-600 text-white shadow-sm shadow-sky-900/40'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-700">
            
            {/* Loading Indicator */}
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                <p className="text-xs">Buscando en PostgreSQL e indexación Wispro...</p>
              </div>
            )}

            {/* Initial Idle State */}
            {!loading && !query && (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">Motor de Búsqueda Universal Velocity</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Escribe al menos 2 caracteres o usa el escáner de cámara. Normalizamos direcciones MAC automáticamente con o sin dos puntos (ej: <code className="text-sky-300 bg-slate-800 px-1 py-0.5 rounded font-mono">E067B3</code>).
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6 max-w-lg mx-auto text-left">
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
                    <span className="font-bold text-sky-400 block mb-0.5">📦 Seriados & ONUs</span>
                    <span className="text-slate-400 text-[11px]">MAC, número de serie, marca, modelo, ubicación.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
                    <span className="font-bold text-emerald-400 block mb-0.5">👤 Wispro Cloud</span>
                    <span className="text-slate-400 text-[11px]">Clientes, DNI, dirección, contrato y nodo OLT.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs">
                    <span className="font-bold text-purple-400 block mb-0.5">🛡️ Auditoría Forense</span>
                    <span className="text-slate-400 text-[11px]">Trazabilidad de movimientos y transferencias.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {showEmptyState && (
              <div className="py-10 text-center text-slate-400">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-200">No se encontraron resultados</h4>
                <p className="text-xs text-slate-400 mt-1">
                  No hay registros coincidentes para "<span className="text-white font-semibold">{query}</span>" en la categoría seleccionada.
                </p>
              </div>
            )}

            {/* 1. SECCIÓN: EQUIPOS SERIADOS (ONUS / ROUTERS) */}
            {hasResults && results.serialized.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5" />
                    Equipos Seriados & ONUs ({results.serialized.length})
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.serialized.map((item) => (
                    <div 
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-white group-hover:text-sky-300 transition">
                            {item.product?.name || 'Equipo Desconocido'}
                          </span>
                          {getStatusBadge(item.status)}
                          {item.product?.brand && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                              {item.product.brand} {item.product.model || ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-300 font-mono flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="text-slate-500">MAC:</span>
                            <strong className="text-sky-300 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/20">{item.macAddress}</strong>
                          </span>
                          {item.serialNumber && (
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500">S/N:</span>
                              <strong className="text-slate-200">{item.serialNumber}</strong>
                            </span>
                          )}
                          {item.currentWarehouse && (
                            <span className="text-slate-400">
                              📍 {item.currentWarehouse.name}
                            </span>
                          )}
                          {item.installedClientName && (
                            <span className="text-emerald-400 font-sans">
                              👤 {item.installedClientName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={(e) => copyToClipboard(item.macAddress, e)}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition inline-flex items-center gap-1"
                          title="Copiar MAC Address"
                        >
                          {copiedText === item.macAddress ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copiar MAC</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            onClose();
                            onNavigateTab('audit', item.macAddress);
                          }}
                          className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition inline-flex items-center gap-1 shadow-sm"
                          title="Ver Trazabilidad Forense Completa"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Trazabilidad</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SECCIÓN: CLIENTES WISPRO */}
            {hasResults && results.clients.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    Clientes Wispro Cloud ({results.clients.length})
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.clients.map((client) => (
                    <div 
                      key={client.id}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                            {client.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {client.status || 'Activo'}
                          </span>
                          {client.contractId && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              Contrato #{client.contractId}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-300 space-y-0.5">
                          {client.address && (
                            <p className="text-slate-400 truncate">📍 {client.address}</p>
                          )}
                          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 flex-wrap">
                            {client.currentOnuMac && (
                              <span className="text-sky-300">ONU MAC: {client.currentOnuMac}</span>
                            )}
                            {client.nodeName && (
                              <span>Nodo: {client.nodeName}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {client.currentOnuMac && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigateTab('audit', client.currentOnuMac);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-slate-700 transition inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Ver ONU</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateTab('wispro', client.name);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Ver Ficha</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. SECCIÓN: MATERIALES & BOBINAS */}
            {hasResults && results.bulk.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Materiales a Granel & Bobinas ({results.bulk.length})
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.bulk.map((b) => (
                    <div 
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-white">{b.product?.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            SKU: {b.product?.sku}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Bodega: <strong className="text-slate-200">{b.warehouse?.name}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-amber-400">
                            {b.quantity} {b.product?.unitOfMeasure || 'uds'}
                          </span>
                          <span className="block text-[10px] text-slate-500">Stock Actual</span>
                        </div>
                        <button
                          onClick={() => {
                            onClose();
                            onNavigateTab('warehouses');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition"
                        >
                          Ver Bodega
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SECCIÓN: TRASLADOS & REMISIONES */}
            {hasResults && results.transfers.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-purple-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    Órdenes de Traslado ({results.transfers.length})
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.transfers.map((t) => (
                    <div 
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-bold text-purple-300">
                            {t.orderNumber}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 flex items-center gap-1.5">
                          <span>{t.sourceWarehouse?.name}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <strong className="text-white">{t.destinationWarehouse?.name}</strong>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onNavigateTab('transfers');
                        }}
                        className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition"
                      >
                        Ver Traslado
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. SECCIÓN: AUDITORÍA FORENSE */}
            {hasResults && results.audit.length > 0 && (
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-rose-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Trazabilidad Forense ({results.audit.length})
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {results.audit.map((log) => (
                    <div 
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {log.eventType || (log as any).action || 'EVENTO'}
                          </span>
                          {log.macAddress && (
                            <span className="text-xs font-mono text-sky-300">{log.macAddress}</span>
                          )}
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto sm:ml-0">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 truncate">{log.details}</p>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          onNavigateTab('audit', log.macAddress || log.serialNumber || undefined);
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition shrink-0"
                      >
                        Abrir Auditoría
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Bottom Shortcuts Bar */}
          <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 rounded border border-slate-700 text-slate-300">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 font-mono bg-slate-800 rounded border border-slate-700 text-slate-300">K</kbd>
                <span className="ml-1 hidden sm:inline">abrir / cerrar</span>
              </span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="hidden md:flex items-center gap-1">
                <Camera className="w-3 h-3 text-sky-400" />
                <span>Escáner de código de barras compatible con celular & webcam</span>
              </span>
            </div>

            {hasResults && (
              <span className="font-semibold text-sky-400">
                {results.totalResults} coincidencias
              </span>
            )}
          </div>

        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
      />
    </>
  );
};
