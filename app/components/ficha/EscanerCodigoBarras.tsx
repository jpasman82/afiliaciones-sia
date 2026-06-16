// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Lector PDF417 del DNI. Estrategia híbrida:
//    1) Cámara en vivo con BrowserPDF417Reader (lector especializado).
//       Aplica autofocus continuo + zoom cuando el dispositivo lo soporta.
//       Tap-to-focus al tocar la pantalla.
//    2) Fallback: "Tomar foto del código" abre la cámara nativa del celular,
//       toma una foto fija (máxima resolución y mejor enfoque) y la decodifica.
//       Útil cuando el video en vivo no engancha.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'iniciando' | 'escaneando' | 'parseado' | 'error' | 'decodificando_foto' | 'foto_sin_codigo';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserPDF417Reader | null>(null);
  const intentosRef = useRef<number>(0);
  const [estado, setEstado] = useState<Estado>('iniciando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [intentos, setIntentos] = useState(0);

  // Arranca / reinicia el escaneo en vivo.
  // Si `esReset` es true, primero limpia el estado visible (botón "Reintentar").
  const iniciarEscaneo = async (esReset = false) => {
    if (esReset) {
      setParsed(null);
      setErrorMsg('');
      setEstado('iniciando');
      setIntentos(0);
    }
    intentosRef.current = 0;

    try { readerRef.current?.reset(); } catch {}

    const reader = new BrowserPDF417Reader(150); // tiempo entre intentos (ms)
    readerRef.current = reader;

    try {
      await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        videoRef.current!,
        (result, err) => {
          if (result) {
            const raw = result.getText();
            const p = parseDniPdf417(raw);
            setParsed(p);
            setEstado('parseado');
            try { reader.reset(); } catch {}
            return;
          }
          if (err && !(err instanceof NotFoundException)) {
            console.debug('[ZXing]', err);
          }
          // Cada vez que el callback corre sin result, es un intento
          intentosRef.current += 1;
          if (intentosRef.current % 5 === 0) setIntentos(intentosRef.current);
        }
      );
      setEstado('escaneando');
      // Una vez que el stream está activo, aplicamos focus + zoom si el dispositivo soporta
      aplicarConstraintsAvanzadas();
    } catch (e: any) {
      setErrorMsg(e?.message || 'No se pudo acceder a la cámara.');
      setEstado('error');
    }
  };

  // Aplica autofocus continuo y zoom 2x si están disponibles
  const aplicarConstraintsAvanzadas = async () => {
    const video = videoRef.current;
    if (!video || !(video.srcObject instanceof MediaStream)) return;
    const track = video.srcObject.getVideoTracks()[0];
    if (!track) return;

    try {
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        focusMode?: string[]; zoom?: { min: number; max: number; step?: number };
      };
      const advanced: any[] = [];
      if (caps.focusMode?.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (caps.zoom) {
        // Zoom moderado para que el PDF417 ocupe más píxeles
        const z = Math.min(2, caps.zoom.max);
        if (z > (caps.zoom.min || 1)) advanced.push({ zoom: z });
      }
      if (advanced.length) {
        await track.applyConstraints({ advanced } as any);
      }
    } catch (e) {
      console.debug('[camera] advanced constraints not applied', e);
    }
  };

  // Tap-to-focus: dispara enfoque puntual al tocar el video
  const onVideoTap = async () => {
    const video = videoRef.current;
    if (!video || !(video.srcObject instanceof MediaStream)) return;
    const track = video.srcObject.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = (track.getCapabilities?.() ?? {}) as any;
      if (caps.focusMode?.includes('single-shot')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] } as any);
        // Volver a continuo después
        setTimeout(() => {
          if (caps.focusMode?.includes('continuous')) {
            track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any).catch(() => {});
          }
        }, 1500);
      } else if (caps.focusMode?.includes('manual') || caps.focusDistance) {
        // No hacemos nada custom; algunos browsers re-enfocan solo al recibir un applyConstraints
        await track.applyConstraints({ advanced: [{}] } as any);
      }
    } catch {
      /* ignorar */
    }
  };

  // Decodifica una foto subida (fallback cuando el video no engancha)
  const decodificarFoto = async (file: File) => {
    setEstado('decodificando_foto');
    try { readerRef.current?.reset(); } catch {}
    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserPDF417Reader();
      const result = await reader.decodeFromImageUrl(url);
      const raw = result.getText();
      const p = parseDniPdf417(raw);
      setParsed(p);
      setEstado('parseado');
    } catch (e) {
      if (e instanceof NotFoundException) {
        setEstado('foto_sin_codigo');
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
    iniciarEscaneo();
    return () => {
      try { readerRef.current?.reset(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const mostrandoVideo = estado === 'iniciando' || estado === 'escaneando' || estado === 'error' || estado === 'decodificando_foto' || estado === 'foto_sin_codigo';

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10">
        <div className="min-w-0">
          <h3 className="font-bold text-lg">Escanear código del DNI</h3>
          <p className="text-xs text-white/60 mt-0.5 truncate">Apuntá al PDF417 del dorso (el rectángulo de barras finas)</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3">Cerrar</button>
      </div>

      {/* Vista del video + overlay */}
      {mostrandoVideo && (
        <div className="flex-1 relative overflow-hidden flex items-center justify-center" onClick={onVideoTap}>
          <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          {/* Marco para el PDF417 (más ancho que alto) */}
          <div className="relative w-[90%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400" />
            {/* Línea animada de escaneo */}
            {estado === 'escaneando' && (
              <div className="absolute left-2 right-2 h-[2px] bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-scanline" />
            )}
          </div>

          {/* Status bar inferior */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-md mx-auto text-center text-white text-sm">
              {estado === 'iniciando' && <p>Iniciando cámara…</p>}
              {estado === 'escaneando' && (
                <p className="text-white/80">
                  Escaneando… <span className="text-white/50">({intentos} intentos)</span>
                  <br />
                  <span className="text-xs text-white/60">Tocá la pantalla para enfocar. Acercá hasta que las barras se vean nítidas.</span>
                </p>
              )}
              {estado === 'decodificando_foto' && <p>Procesando foto…</p>}
              {estado === 'foto_sin_codigo' && <p className="text-amber-300">No se detectó código en la foto. Probá con otra más cercana o nítida.</p>}
              {estado === 'error' && <p className="text-rose-300">{errorMsg}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior con acciones cuando está escaneando */}
      {(estado === 'escaneando' || estado === 'foto_sin_codigo') && (
        <div className="bg-black p-4 z-10">
          <label className="block max-w-md mx-auto py-3 px-4 rounded-lg bg-white text-slate-900 font-semibold text-sm text-center cursor-pointer active:bg-slate-100">
            📷 No detecta? Tomar foto del código
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) decodificarFoto(f);
                e.target.value = ''; // permitir reintentar con la misma cámara
              }}
            />
          </label>
        </div>
      )}

      {/* Estado de error: opciones de reintento */}
      {estado === 'error' && (
        <div className="bg-black p-4 flex gap-3 max-w-md mx-auto w-full">
          <button onClick={() => iniciarEscaneo(true)} className="flex-1 py-3 bg-white text-slate-900 font-semibold rounded-lg">Reintentar</button>
          <button onClick={onClose} className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-lg">Cerrar</button>
        </div>
      )}

      {/* Panel de resultado parseado */}
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

          <div className="p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full">
            <button
              onClick={() => iniciarEscaneo(true)}
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