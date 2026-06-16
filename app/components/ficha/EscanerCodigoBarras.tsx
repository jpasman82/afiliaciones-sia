// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Lector PDF417 del DNI con captura explícita (sin decodificación continua).
//  Dos rutas, ambas mucho más confiables que decodificar video en vivo:
//    1) "Capturar ahora": toma el frame actual del video a resolución completa
//       y lo decodifica como imagen fija.
//    2) "Tomar foto": abre la cámara nativa del celular (máxima resolución
//       del sensor + autofocus de la app de cámara) y decodifica la foto.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'iniciando' | 'listo' | 'decodificando' | 'parseado' | 'sin_codigo' | 'error';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<Estado>('iniciando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [videoRes, setVideoRes] = useState<string>('—');

  // Inicia el stream de cámara (preview en vivo, sin decode automático)
  const iniciarCamara = async () => {
    setErrorMsg('');
    detenerCamara();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 3840 },
          height: { ideal: 2160 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Mostrar la resolución real
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setVideoRes(`${settings.width || '?'}×${settings.height || '?'}`);
      // Aplicar autofocus continuo + zoom si el dispositivo soporta
      aplicarConstraintsAvanzadas(track);
      setEstado('listo');
    } catch (e: any) {
      setErrorMsg(e?.message || 'No se pudo acceder a la cámara.');
      setEstado('error');
    }
  };

  const aplicarConstraintsAvanzadas = async (track: MediaStreamTrack) => {
    try {
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        focusMode?: string[]; zoom?: { min: number; max: number; step?: number };
      };
      const advanced: any[] = [];
      if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
      if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
        advanced.push({ zoom: Math.min(2, caps.zoom.max) });
      }
      if (advanced.length) await track.applyConstraints({ advanced } as any);
    } catch (e) {
      console.debug('[camera] advanced constraints not applied', e);
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  // Tap-to-focus
  const onVideoTap = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = (track.getCapabilities?.() ?? {}) as any;
      if (caps.focusMode?.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] } as any);
        setTimeout(() => {
          if (caps.focusMode?.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any).catch(() => {});
          }
        }, 1500);
      }
    } catch { /* ignorar */ }
  };

  // Construye un reader con TRY_HARDER
  const buildReader = () => {
    const reader = new BrowserPDF417Reader();
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    (reader as any).hints = hints;
    return reader;
  };

  // Captura el frame actual del video a resolución completa y lo decodifica
  const capturarYDecodificar = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setEstado('decodificando');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setEstado('listo'); return; }
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    try {
      const reader = buildReader();
      const result = await reader.decodeFromImageUrl(dataUrl);
      const raw = result.getText();
      const p = parseDniPdf417(raw);
      setParsed(p);
      setEstado('parseado');
      detenerCamara();
    } catch (e) {
      if (e instanceof NotFoundException) {
        setEstado('sin_codigo');
      } else {
        setErrorMsg((e as any)?.message || 'Error al decodificar.');
        setEstado('error');
      }
    }
  };

  // Decodifica una foto tomada con la cámara nativa
  const decodificarFoto = async (file: File) => {
    setEstado('decodificando');
    const url = URL.createObjectURL(file);
    try {
      const reader = buildReader();
      const result = await reader.decodeFromImageUrl(url);
      const raw = result.getText();
      const p = parseDniPdf417(raw);
      setParsed(p);
      setEstado('parseado');
      detenerCamara();
    } catch (e) {
      if (e instanceof NotFoundException) {
        setEstado('sin_codigo');
      } else {
        setErrorMsg((e as any)?.message || 'No se pudo procesar la imagen.');
        setEstado('error');
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    iniciarCamara();
    return () => detenerCamara();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const reintentar = () => {
    setParsed(null);
    setErrorMsg('');
    setEstado('iniciando');
    iniciarCamara();
  };

  const mostrandoCamara = estado === 'iniciando' || estado === 'listo' || estado === 'decodificando' || estado === 'sin_codigo';

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10 shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-base">Escanear DNI</h3>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">PDF417 del dorso (rectángulo de barras verticales finas)</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3">Cerrar</button>
      </div>

      {mostrandoCamara && (
        <>
          {/* Video preview */}
          <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0" onClick={onVideoTap}>
            <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            {/* Marco para el PDF417 (rectángulo ancho) */}
            <div className="relative w-[92%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
              <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-green-400" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-green-400" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-green-400" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-green-400" />
            </div>

            {/* Diagnóstico */}
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded">
              {videoRes}
            </div>

            {/* Estado overlay */}
            <div className="absolute bottom-3 left-0 right-0 text-center text-white text-sm font-medium px-4 pointer-events-none">
              {estado === 'iniciando' && 'Iniciando cámara…'}
              {estado === 'listo' && <span className="text-white/80">Centrá el código y tocá una opción</span>}
              {estado === 'decodificando' && <span className="text-white bg-black/60 px-3 py-1.5 rounded-lg">Decodificando…</span>}
              {estado === 'sin_codigo' && <span className="text-amber-300 bg-black/70 px-3 py-1.5 rounded-lg">No se detectó código. Probá acercar más, mejor luz, o &quot;Tomar foto&quot;.</span>}
            </div>
          </div>

          {/* Acciones */}
          <div className="bg-black p-4 flex flex-col gap-2.5 shrink-0">
            <button
              onClick={capturarYDecodificar}
              disabled={estado === 'decodificando' || estado === 'iniciando'}
              className="w-full py-3.5 rounded-lg bg-white text-slate-900 font-bold text-sm shadow-lg active:bg-slate-100 disabled:opacity-50"
            >
              📸 Capturar y decodificar
            </button>

            <label className={`w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg text-center cursor-pointer active:bg-emerald-700 ${estado === 'decodificando' ? 'opacity-50 pointer-events-none' : ''}`}>
              📷 Tomar foto con cámara nativa
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) decodificarFoto(f);
                  e.target.value = '';
                }}
              />
            </label>

            <p className="text-[11px] text-white/50 text-center mt-0.5">
              ¿No funciona el primero? Usá &quot;Tomar foto&quot; — abre la cámara del celular y usa la máxima resolución.
            </p>
          </div>
        </>
      )}

      {/* Error con cámara */}
      {estado === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <p className="text-rose-300 text-center mb-6 max-w-sm">{errorMsg}</p>
          <div className="flex gap-3 max-w-md w-full">
            <button onClick={reintentar} className="flex-1 py-3 bg-white text-slate-900 font-semibold rounded-lg">Reintentar</button>
            <button onClick={onClose} className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-lg">Cerrar</button>
          </div>
        </div>
      )}

      {/* Resultado parseado */}
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

          <div className="p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full shrink-0">
            <button
              onClick={reintentar}
              className="flex-1 py-3 rounded-lg bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Reintentar
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