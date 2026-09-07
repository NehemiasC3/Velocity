import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Copy, Check, Home, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
  onReset?: () => void;
  fallbackRender?: (error: Error, resetErrorBoundary: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Telemetría y registro en consola
    console.error(`[Velocity ErrorBoundary] Error capturado en "${this.props.moduleName || 'Componente'}":`, error);
    console.error('[Velocity ErrorBoundary] Stack Trace del Componente:', errorInfo.componentStack);
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleCopyDiagnostics = () => {
    const diagnosticData = [
      `=== DIAGNÓSTICO DE ERROR VELOCITY ===`,
      `Módulo: ${this.props.moduleName || 'General'}`,
      `Fecha: ${new Date().toISOString()}`,
      `Error: ${this.state.error?.name}: ${this.state.error?.message}`,
      `Stack: ${this.state.error?.stack || 'No disponible'}`,
      `Component Stack: ${this.state.errorInfo?.componentStack || 'No disponible'}`
    ].join('\n\n');

    navigator.clipboard.writeText(diagnosticData).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender && this.state.error) {
        return this.props.fallbackRender(this.state.error, this.handleReset);
      }

      const moduleTitle = this.props.moduleName || 'Módulo de Operaciones';

      return (
        <div className="w-full my-6 p-6 sm:p-8 bg-white border border-rose-200 rounded-3xl shadow-sm text-slate-800 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-rose-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Error Protegido en {moduleTitle}
                  </h3>
                  <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    Auto-Aislado
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  El sistema detectó una excepción en este módulo y evitó que afecte el resto de la plataforma.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar Módulo</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                title="Copiar diagnóstico para soporte"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Diagnóstico</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mensaje amigable */}
          <div className="mt-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="font-semibold text-rose-900">Mensaje de error: </strong>
              <code className="font-mono text-rose-800 bg-rose-100/60 px-1.5 py-0.5 rounded">
                {this.state.error?.message || 'Error desconocido durante la ejecución del componente.'}
              </code>
            </div>
          </div>

          {/* Toggle de detalles técnicos */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{this.state.showDetails ? '▼ Ocultar detalles técnicos' : '▶ Mostrar detalles técnicos del stack'}</span>
            </button>

            {this.state.showDetails && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed scrollbar-thin">
                <p className="text-rose-400 font-bold mb-1">{this.state.error?.stack}</p>
                {this.state.errorInfo?.componentStack && (
                  <p className="text-slate-400 mt-2 border-t border-slate-800 pt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
