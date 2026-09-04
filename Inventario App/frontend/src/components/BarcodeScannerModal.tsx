import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Flashlight, RefreshCw, AlertCircle, CheckCircle2, ScanLine } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (scannedCode: string) => void;
  title?: string;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'Escanear Código de Barras / QR'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Iniciar cámara al abrir modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);
    setScannedFeedback(null);

    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      // Chequear soporte de linterna (torch)
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setTorchSupported(Boolean(capabilities.torch));
      }

      // Comenzar ciclo de detección
      startDetectionLoop(mediaStream);
    } catch (err: any) {
      console.error('[BarcodeScanner] Error al acceder a la cámara:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Permite el acceso a la cámara en tu navegador.'
          : 'No se pudo iniciar la cámara en este dispositivo. Puedes ingresar el código manualmente abajo.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setTorchEnabled(false);
  };

  const toggleTorch = async () => {
    if (!stream || !torchSupported) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn('Torch no soportado:', e);
      }
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleSuccessfulScan = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Feedback haptico/vibración si está disponible
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([80, 50, 80]); } catch (e) {}
    }

    setScannedFeedback(cleanCode);
    setIsScanning(false);
    stopCamera();

    setTimeout(() => {
      onScan(cleanCode);
      onClose();
    }, 600);
  };

  const startDetectionLoop = (mediaStream: MediaStream) => {
    const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector: any = null;

    if (hasNativeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: [
            'qr_code',
            'code_128',
            'code_39',
            'code_93',
            'ean_13',
            'ean_8',
            'upc_a',
            'upc_e',
            'data_matrix',
            'itf'
          ]
        });
      } catch (e) {
        detector = null;
      }
    }

    const checkFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(checkFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleSuccessfulScan(rawValue);
              return;
            }
          }
        } catch (e) {
          // Fallback silencioso por frame
        }
      }

      scanLoopRef.current = requestAnimationFrame(checkFrame);
    };

    scanLoopRef.current = requestAnimationFrame(checkFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleSuccessfulScan(manualInput.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <ScanLine className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
              <p className="text-[11px] text-slate-400">Apunta la cámara al código de barras o QR de la ONU / Bobina</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar Cámara
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Aiming Reticle Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-48 border-2 border-dashed border-sky-400/80 rounded-xl bg-sky-500/5 shadow-[0_0_20px_rgba(56,189,248,0.2)] flex items-center justify-center">
                  {/* Scanning Laser Line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-[bounce_2s_infinite]" />
                  
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-sky-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-sky-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-sky-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-sky-400" />

                  <span className="text-[10px] uppercase font-bold tracking-widest text-sky-300/80 bg-slate-950/70 px-2 py-0.5 rounded-full border border-sky-400/30">
                    Alinear Código
                  </span>
                </div>
              </div>

              {/* Scanned Confirmation Banner */}
              {scannedFeedback && (
                <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-2 text-white animate-scaleIn">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                  <span className="text-xs uppercase tracking-wider text-emerald-300 font-bold">¡Código Detectado!</span>
                  <span className="text-sm font-mono font-bold bg-slate-900 px-3 py-1 rounded border border-emerald-500/40">
                    {scannedFeedback}
                  </span>
                </div>
              )}

              {/* Video Controls overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                {torchSupported && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-xl border backdrop-blur-md transition ${
                      torchEnabled 
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30' 
                        : 'bg-slate-900/70 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                    title="Encender Linterna / Flash"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={switchCamera}
                  className="p-2.5 rounded-xl bg-slate-900/70 text-slate-200 border border-slate-700 hover:bg-slate-800 backdrop-blur-md transition ml-auto"
                  title="Cambiar Cámara Trasera / Frontal"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="O escribe MAC, Serial o SKU manualmente..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition"
            >
              Aplicar
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
