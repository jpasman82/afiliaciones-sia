// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Una sola pantalla: cámara en vivo dentro de la app + recuadro de guía +
//  botón "Capturar". Al capturar usamos ImageCapture (foto a resolución
//  máxima del sensor) si está disponible, si no canvas grab del video, y
//  decodificamos la imagen entera con ZXing.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'capturando' | 'decodificando' | 'parseado' | 'sin_codigo';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const [estado, setEstado] = useState<Estado>('capturando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const decodificarBlob = async (blob: Blob) => {
    setEstado('decodificando');
    const url = URL.createObjectURL(blob);
    try {
      const reader = new BrowserPDF417Reader();
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      (reader as any).hints = hints;
      const result = await reader.decodeFromImageUrl(url);
      const raw = result.getText();
      const p = parseDniPdf417(raw);
      setParsed(p);
      setEstado('parseado');
    } catch (e) {
      if (e instanceof NotFoundException) {
        setErrorMsg('No se detectó el código. Acercá más, mejor luz, mantené el celular firme y reintentá.');
      } else {
        setErrorMsg((e as any)?.message || 'Error al decodificar.');
      }
      setEstado('sin_codigo');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const reintentar = () => {
    setParsed(null);
    setErrorMsg('');
    setEstado('capturando');
  };

  const subtitulo = (() => {
    switch (estado) {
      case 'capturando':    return 'Alineá el código de barras dentro del recuadro';
      case 'decodificando': return 'Decodificando…';
      case 'parseado':      return 'Revisá los datos detectados';
      case 'sin_codigo':    return 'No se detectó el código';
    }
  })();

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-3 md:p-4 bg-black text-white flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-base">Escanear DNI</h3>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">{subtitulo}</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3">Cerrar</button>
      </div>

      {(estado === 'capturando' || estado === 'decodificando' || estado === 'sin_codigo') && (
        <Camara
          decodingState={estado}
          errorMsg={errorMsg}
          onCapture={decodificarBlob}
          onRetry={reintentar}
        />
      )}

      {estado === 'parseado' && parsed && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-auto">
          <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-emerald-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h4 className="text-base font-bold text-slate-900">Datos detectados</h4>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <Row label="Apellidos" value={parsed.apellidos} />
                <Row label="Nombres" value={parsed.nombres} />
                <Row label="DNI" value={parsed.dni} mono />
                <Row label="Sexo" value={parsed.sexo} />
                <Row label="Fecha nac." value={parsed.fechaNacimiento} mono />
                <Row label="Clase" value={parsed.clase} mono />
                {parsed.cuil && <Row label="CUIL" value={parsed.cuil} mono full />}
                {parsed.ejemplar && <Row label="Ejemplar" value={parsed.ejemplar} />}
              </dl>

              {parsed.warnings.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 ring-1 ring-amber-200">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Avisos</p>
                  <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                    {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Ver texto crudo del código</summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">{parsed.raw}</pre>
              </details>
            </div>
          </div>

          <div className="p-3 md:p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full shrink-0">
            <button
              onClick={reintentar}
              className="flex-1 py-3 rounded-lg bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Escanear otro
            </button>
            <button
              onClick={aplicar}
              disabled={!parsed.apellidos && !parsed.nombres && !parsed.dni}
              className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar al formulario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  Cámara in-app con recuadro de guía y botón "Capturar"
// ============================================================================

function Camara({
  decodingState, errorMsg, onCapture, onRetry,
}: {
  decodingState: Estado;
  errorMsg: string;
  onCapture: (blob: Blob) => void;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [videoRes, setVideoRes] = useState('—');
  const [photoRes, setPhotoRes] = useState('');

  useEffect(() => {
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 3840 },
            height: { ideal: 2160 },
          },
        });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        setVideoRes(`${settings.width || '?'}×${settings.height || '?'}`);

        // Autofocus continuo + zoom moderado
        try {
          const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
            focusMode?: string[]; zoom?: { min: number; max: number };
          };
          const advanced: any[] = [];
          if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
          if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
            advanced.push({ zoom: Math.min(2, caps.zoom.max) });
          }
          if (advanced.length) await track.applyConstraints({ advanced } as any);
        } catch { /* sin focus/zoom, seguimos */ }

        // Detectar resolución máxima de foto via ImageCapture (informativo)
        const IC = (window as any).ImageCapture;
        if (typeof IC !== 'undefined') {
          try {
            const ic = new IC(track);
            const caps = await ic.getPhotoCapabilities();
            if (caps?.imageWidth?.max && caps?.imageHeight?.max) {
              setPhotoRes(`${caps.imageWidth.max}×${caps.imageHeight.max}`);
            }
          } catch { /* sin info de foto */ }
        }

        setIniciando(false);
      } catch (e: any) {
        if (!stopped) {
          setCameraError(e?.message || 'No se pudo acceder a la cámara.');
          setIniciando(false);
        }
      }
    };

    start();
    return stop;
  }, []);

  // Captura: ImageCapture si está disponible (foto a max resolución del sensor),
  // si no canvas grab del video al vuelo (resolución del stream).
  const capturar = async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!video || !track) return;

    const IC = (window as any).ImageCapture;
    if (typeof IC !== 'undefined') {
      try {
        const ic = new IC(track);
        let settings: any = undefined;
        try {
          const caps = await ic.getPhotoCapabilities();
          if (caps?.imageWidth?.max && caps?.imageHeight?.max) {
            settings = { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max };
          }
        } catch { /* sin caps, tomamos sin settings */ }
        const blob: Blob = settings ? await ic.takePhoto(settings) : await ic.takePhoto();
        onCapture(blob);
        return;
      } catch (e) {
        console.debug('[ImageCapture] failed, fallback to canvas', e);
      }
    }

    // Fallback: canvas grab del video
    if (video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => { if (blob) onCapture(blob); }, 'image/png');
    }
  };

  const disabled = iniciando || decodingState === 'decodificando' || !!cameraError;

  return (
    <>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Recuadro de guía (proporciones del PDF417) */}
        <div className="relative w-[92%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
          <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-green-400" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-green-400" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-green-400" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-green-400" />
        </div>

        {/* Diagnóstico de resolución */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded leading-tight">
          <div>Video: {videoRes}</div>
          {photoRes && <div>Foto: {photoRes}</div>}
        </div>

        {/* Mensaje inferior */}
        <div className="absolute bottom-3 left-0 right-0 text-center text-sm font-medium px-4 pointer-events-none">
          {iniciando && <span className="text-white/80">Iniciando cámara…</span>}
          {!iniciando && !cameraError && decodingState === 'capturando' && (
            <span className="text-white/85">Tocá &quot;Capturar&quot; cuando esté nítido</span>
          )}
          {decodingState === 'decodificando' && (
            <span className="text-white bg-black/70 px-3 py-1.5 rounded-lg">Decodificando…</span>
          )}
          {decodingState === 'sin_codigo' && (
            <span className="text-white bg-amber-500/90 px-3 py-1.5 rounded-lg max-w-[92%] inline-block">{errorMsg}</span>
          )}
          {cameraError && <span className="text-rose-300 bg-black/70 px-3 py-1.5 rounded-lg">{cameraError}</span>}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0">
        {decodingState === 'sin_codigo' ? (
          <button
            onClick={onRetry}
            className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700"
          >
            ↺ Reintentar
          </button>
        ) : (
          <button
            onClick={capturar}
            disabled={disabled}
            className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
          >
            📸 Capturar y leer
          </button>
        )}
      </div>
    </>
  );
}

function Row({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 ${mono ? 'tnum font-mono' : 'font-medium'} ${value ? '' : 'text-slate-400 italic'}`}>
        {value || '—'}
      </dd>
    </div>
  );
}