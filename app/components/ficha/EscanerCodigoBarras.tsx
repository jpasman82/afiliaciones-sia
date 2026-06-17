// ============================================================================
// app/components/ficha/EscanerCodigoBarras.tsx
//
// Flujo:
// 1) Cámara SOLO para sacar una foto.
// 2) Se muestra la foto.
// 3) El usuario marca con el dedo/mouse la zona donde está el PDF417.
// 4) Se escanea únicamente ese recorte.
// ============================================================================
'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'camara' | 'seleccionar' | 'leyendo' | 'parseado' | 'error';

type Crop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const CROP_INICIAL: Crop = {
  x: 0.06,
  y: 0.38,
  w: 0.88,
  h: 0.22,
};

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const [estado, setEstado] = useState<Estado>('camara');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [crop, setCrop] = useState<Crop>(CROP_INICIAL);
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fotoUrlRef = useRef('');

  useEffect(() => {
    return () => {
      if (fotoUrlRef.current) {
        URL.revokeObjectURL(fotoUrlRef.current);
      }
    };
  }, []);

  const cargarFoto = (blob: Blob) => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
    }

    const url = URL.createObjectURL(blob);
    fotoUrlRef.current = url;

    setFotoBlob(blob);
    setFotoUrl(url);
    setCrop(CROP_INICIAL);
    setParsed(null);
    setErrorMsg('');
    setEstado('seleccionar');
  };

  const sacarOtraFoto = () => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
      fotoUrlRef.current = '';
    }

    setFotoBlob(null);
    setFotoUrl('');
    setCrop(CROP_INICIAL);
    setParsed(null);
    setErrorMsg('');
    setEstado('camara');
  };

  const leerZonaMarcada = async () => {
    if (!fotoBlob) return;

    setEstado('leyendo');
    setErrorMsg('');

    try {
      const recortes = await crearRecortesParaLeer(fotoBlob, crop);
      let ultimoError: unknown = null;

      for (const recorte of recortes) {
        try {
          const raw = await decodificarImagen(recorte);
          const p = parseDniPdf417(raw);

          setParsed(p);
          setEstado('parseado');
          return;
        } catch (e) {
          ultimoError = e;
        }
      }

      throw ultimoError ?? new NotFoundException();
    } catch (e) {
      if (esNotFoundException(e)) {
        setErrorMsg(
          'No se leyó el código. Ajustá el recuadro para que incluya solo el PDF417 y probá de nuevo.',
        );
      } else {
        setErrorMsg((e as Error)?.message || 'No se pudo leer el código.');
      }

      setEstado('error');
    }
  };

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const subtitulo = (() => {
    if (estado === 'camara') return 'Sacá una foto del dorso del DNI';
    if (estado === 'seleccionar') return 'Marcá con el dedo la zona del código de barras';
    if (estado === 'leyendo') return 'Leyendo únicamente la zona marcada';
    if (estado === 'error') return 'No se pudo leer el recorte';
    return 'Revisá los datos detectados';
  })();

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-3 md:p-4 bg-black text-white flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-base">Escanear DNI desde foto</h3>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">{subtitulo}</p>
        </div>

        <button
          onClick={onClose}
          className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3"
        >
          Cerrar
        </button>
      </div>

      {estado === 'camara' && <CamaraFoto onPhoto={cargarFoto} />}

      {(estado === 'seleccionar' || estado === 'leyendo' || estado === 'error') && fotoUrl && (
        <SeleccionarRecorte
          fotoUrl={fotoUrl}
          crop={crop}
          setCrop={setCrop}
          leyendo={estado === 'leyendo'}
          errorMsg={estado === 'error' ? errorMsg : ''}
          onLeer={leerZonaMarcada}
          onOtraFoto={sacarOtraFoto}
          onPhoto={cargarFoto}
        />
      )}

      {estado === 'parseado' && parsed && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-auto">
          <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-xl ring-1 ring-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-emerald-600"
                  >
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
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="mt-4">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                  Ver texto crudo del código
                </summary>

                <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                  {parsed.raw}
                </pre>
              </details>
            </div>
          </div>

          <div className="p-3 md:p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full shrink-0">
            <button
              onClick={sacarOtraFoto}
              className="flex-1 py-3 rounded-lg bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Sacar otra foto
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

function CamaraFoto({ onPhoto }: { onPhoto: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [iniciando, setIniciando] = useState(true);
  const [tomandoFoto, setTomandoFoto] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        await intentarAutoFocus(track);

        setIniciando(false);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error)?.message || 'No se pudo abrir la cámara.');
          setIniciando(false);
        }
      }
    };

    void start();

    return stop;
  }, []);

  const capturar = async () => {
    if (tomandoFoto) return;

    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];

    if (!video || !track) return;

    setTomandoFoto(true);
    setError('');

    try {
      const blob = await sacarFoto(track, video);

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      onPhoto(blob);
    } catch (e) {
      setError((e as Error)?.message || 'No se pudo sacar la foto.');
      setTomandoFoto(false);
    }
  };

  return (
    <>
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-black/20" />

        <div className="absolute left-3 right-3 bottom-4 text-center pointer-events-none">
          {iniciando && <span className="text-white/80 text-sm">Iniciando cámara…</span>}

          {!iniciando && !error && !tomandoFoto && (
            <span className="text-white bg-black/60 px-3 py-2 rounded-lg text-sm font-medium inline-block">
              Sacá una foto del dorso. Después vas a marcar el código sobre la foto.
            </span>
          )}

          {tomandoFoto && (
            <span className="text-white bg-black/70 px-3 py-2 rounded-lg text-sm font-medium">
              Sacando foto…
            </span>
          )}

          {error && (
            <span className="text-rose-200 bg-black/70 px-3 py-2 rounded-lg text-sm font-medium inline-block">
              {error}
            </span>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              onPhoto(file);
            }

            e.currentTarget.value = '';
          }}
        />

        <button
          onClick={capturar}
          disabled={iniciando || tomandoFoto || !!error}
          className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
        >
          📸 Sacar foto
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15"
        >
          Usar cámara nativa / elegir foto
        </button>
      </div>
    </>
  );
}

function SeleccionarRecorte({
  fotoUrl,
  crop,
  setCrop,
  leyendo,
  errorMsg,
  onLeer,
  onOtraFoto,
  onPhoto,
}: {
  fotoUrl: string;
  crop: Crop;
  setCrop: (crop: Crop) => void;
  leyendo: boolean;
  errorMsg: string;
  onLeer: () => void;
  onOtraFoto: () => void;
  onPhoto: (blob: Blob) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const puntoDesdeEvento = (event: PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return null;

    const bounds = overlay.getBoundingClientRect();

    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const empezar = (event: PointerEvent<HTMLDivElement>) => {
    if (leyendo) return;

    const punto = puntoDesdeEvento(event);
    if (!punto) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = punto;

    setCrop({
      x: punto.x,
      y: punto.y,
      w: 0.01,
      h: 0.01,
    });
  };

  const mover = (event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current || leyendo) return;

    const punto = puntoDesdeEvento(event);
    if (!punto) return;

    const start = startRef.current;

    setCrop(
      normalizarCrop({
        x: Math.min(start.x, punto.x),
        y: Math.min(start.y, punto.y),
        w: Math.abs(punto.x - start.x),
        h: Math.abs(punto.y - start.y),
      }),
    );
  };

  const terminar = (event: PointerEvent<HTMLDivElement>) => {
    startRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Algunos navegadores no requieren liberar captura.
    }
  };

  return (
    <>
      <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center overflow-hidden p-2">
        <div className="relative inline-block max-w-full max-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoUrl}
            alt="Foto del DNI"
            draggable={false}
            className="block max-w-full max-h-[calc(100vh-190px)] select-none touch-none"
          />

          <div
            ref={overlayRef}
            className="absolute inset-0 touch-none cursor-crosshair"
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          >
            <div className="absolute inset-0 bg-black/10" />

            <div
              className="absolute border-4 border-emerald-400 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="absolute top-3 left-3 right-3 text-center pointer-events-none">
          {leyendo ? (
            <span className="text-white bg-black/75 px-3 py-2 rounded-lg text-sm font-medium inline-block">
              Leyendo solo el recorte marcado…
            </span>
          ) : errorMsg ? (
            <span className="text-white bg-amber-500/95 px-3 py-2 rounded-lg text-xs font-medium inline-block max-w-[96%]">
              {errorMsg}
            </span>
          ) : (
            <span className="text-white bg-black/60 px-3 py-2 rounded-lg text-xs font-medium inline-block">
              Arrastrá sobre el código PDF417 para marcar la zona exacta.
            </span>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              onPhoto(file);
            }

            e.currentTarget.value = '';
          }}
        />

        <button
          onClick={onLeer}
          disabled={leyendo}
          className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
        >
          {leyendo ? 'Leyendo recorte…' : 'Escanear zona marcada'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOtraFoto}
            disabled={leyendo}
            className="py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15 disabled:opacity-50"
          >
            Sacar otra foto
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={leyendo}
            className="py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15 disabled:opacity-50"
          >
            Elegir foto
          </button>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd
        className={`text-sm text-slate-900 ${
          mono ? 'tnum font-mono' : 'font-medium'
        } ${value ? '' : 'text-slate-400 italic'}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

async function intentarAutoFocus(track: MediaStreamTrack) {
  try {
    const caps = track.getCapabilities?.() as
      | (MediaTrackCapabilities & {
          focusMode?: string[];
          zoom?: { max: number };
        })
      | undefined;

    const advanced: Array<MediaTrackConstraintSet & { focusMode?: string; zoom?: number }> = [];

    if (caps?.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }

    if (caps?.zoom?.max && caps.zoom.max > 1) {
      advanced.push({ zoom: Math.min(2, caps.zoom.max) });
    }

    if (advanced.length) {
      await track.applyConstraints({
        advanced: advanced as MediaTrackConstraintSet[],
      });
    }
  } catch {
    // No todos los navegadores soportan focus/zoom.
  }
}

async function sacarFoto(track: MediaStreamTrack, video: HTMLVideoElement): Promise<Blob> {
  const ImageCaptureClass = (window as Window & {
    ImageCapture?: new (track: MediaStreamTrack) => {
      takePhoto: () => Promise<Blob>;
    };
  }).ImageCapture;

  if (ImageCaptureClass) {
    try {
      const imageCapture = new ImageCaptureClass(track);
      return await imageCapture.takePhoto();
    } catch {
      // Si ImageCapture falla, usamos el frame del video.
    }
  }

  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('La cámara todavía no está lista.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo preparar la foto.');
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return canvasToBlob(canvas, 'image/jpeg', 0.95);
}

async function crearRecortesParaLeer(blob: Blob, crop: Crop): Promise<Blob[]> {
  const img = await cargarImagen(blob);
  const zona = normalizarCrop(crop);

  return [
    await recortarImagen(img, zona, { margen: 0, contraste: false }),
    await recortarImagen(img, zona, { margen: 0, contraste: true }),
    await recortarImagen(img, zona, { margen: 0.06, contraste: false }),
    await recortarImagen(img, zona, { margen: 0.06, contraste: true }),
  ];
}

function cargarImagen(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la foto.'));
    };

    img.src = url;
  });
}

async function recortarImagen(
  img: HTMLImageElement,
  crop: Crop,
  options: { margen: number; contraste: boolean },
): Promise<Blob> {
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;

  const margenX = crop.w * options.margen;
  const margenY = crop.h * options.margen;

  const x1 = clamp(crop.x - margenX, 0, 1);
  const y1 = clamp(crop.y - margenY, 0, 1);
  const x2 = clamp(crop.x + crop.w + margenX, 0, 1);
  const y2 = clamp(crop.y + crop.h + margenY, 0, 1);

  const sx = Math.round(x1 * sourceW);
  const sy = Math.round(y1 * sourceH);
  const sw = Math.max(1, Math.round((x2 - x1) * sourceW));
  const sh = Math.max(1, Math.round((y2 - y1) * sourceH));

  const targetW = Math.min(2600, Math.max(1200, sw));
  const targetH = Math.max(260, Math.round(targetW * (sh / sw)));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: options.contraste,
  });

  if (!ctx) {
    throw new Error('No se pudo preparar el recorte.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  if (options.contraste) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = clamp((gray - 128) * 1.55 + 128, 0, 255);

      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return canvasToBlob(canvas, 'image/jpeg', 0.95);
}

async function decodificarImagen(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);

  try {
    const reader = new BrowserPDF417Reader();
    const hints = new Map<DecodeHintType, unknown>();

    hints.set(DecodeHintType.TRY_HARDER, true);

    (reader as BrowserPDF417Reader & {
      hints?: Map<DecodeHintType, unknown>;
    }).hints = hints;

    const result = await reader.decodeFromImageUrl(url);

    return result.getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo generar la imagen.'));
        }
      },
      type,
      quality,
    );
  });
}

function normalizarCrop(crop: Crop): Crop {
  const w = clamp(crop.w, 0.03, 1);
  const h = clamp(crop.h, 0.03, 1);
  const x = clamp(crop.x, 0, 1 - w);
  const y = clamp(crop.y, 0, 1 - h);

  return { x, y, w, h };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function esNotFoundException(e: unknown) {
  return e instanceof NotFoundException || (e as { name?: string })?.name === 'NotFoundException';
}