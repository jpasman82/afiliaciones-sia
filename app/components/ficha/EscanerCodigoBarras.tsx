// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//
//  SIN ESCANEO EN VIVO.
//
//  Flujo:
//  1) La cámara se usa solamente como visor para enfocar el PDF417.
//  2) El usuario ubica el código dentro del recuadro.
//  3) Toca "Sacar foto y leer".
//  4) Se toma una foto.
//  5) Se cierra la cámara.
//  6) La lectura se hace desde la foto capturada.
//
//  Importante:
//  - No usa decodeFromVideoDevice.
//  - No lee frames continuamente.
//  - Solo decodifica una imagen ya capturada.
// ============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'camara' | 'decodificando' | 'parseado' | 'sin_codigo';

type ImageVariant = {
  label: string;
  blob: Blob;
};

type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number };
};

type PhotoCapabilities = {
  imageWidth?: { max?: number };
  imageHeight?: { max?: number };
};

type ImageCaptureLike = {
  takePhoto: (settings?: { imageWidth?: number; imageHeight?: number }) => Promise<Blob>;
  getPhotoCapabilities?: () => Promise<PhotoCapabilities>;
};

type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const [estado, setEstado] = useState<Estado>('camara');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');

  const fotoUrlRef = useRef('');

  useEffect(() => {
    return () => {
      if (fotoUrlRef.current) {
        URL.revokeObjectURL(fotoUrlRef.current);
      }
    };
  }, []);

  const limpiarFotoAnterior = () => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
      fotoUrlRef.current = '';
    }

    setFotoUrl('');
    setFotoBlob(null);
  };

  const guardarFotoYLeer = (blob: Blob) => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
    }

    const url = URL.createObjectURL(blob);

    fotoUrlRef.current = url;
    setFotoBlob(blob);
    setFotoUrl(url);
    setParsed(null);
    setErrorMsg('');
    setEstado('decodificando');

    // Acá empieza la lectura, pero desde la foto/blob.
    // No se lee desde el video ni desde el stream de la cámara.
    void leerDesdeFoto(blob);
  };

  const leerDesdeFoto = async (blob: Blob) => {
    setEstado('decodificando');
    setErrorMsg('');

    try {
      const variants = await crearVariantesParaPdf417(blob);
      let lastError: unknown = null;

      for (const variant of variants) {
        try {
          const raw = await decodificarImagen(variant.blob);
          const p = parseDniPdf417(raw);

          console.info(`[DNI PDF417] leído desde foto: ${variant.label}`);

          setParsed(p);
          setEstado('parseado');
          return;
        } catch (e) {
          lastError = e;
        }
      }

      throw lastError ?? new NotFoundException();
    } catch (e) {
      if (esNotFoundException(e)) {
        setErrorMsg(
          'No se detectó el código en la foto. Probá sacar otra foto más cerca, con buena luz y con todo el código dentro del recuadro.',
        );
      } else {
        setErrorMsg((e as Error)?.message || 'Error al leer el código desde la foto.');
      }

      setEstado('sin_codigo');
    }
  };

  const cargarFotoNativa = (file: File | undefined) => {
    if (!file) return;
    guardarFotoYLeer(file);
  };

  const reintentar = () => {
    limpiarFotoAnterior();
    setParsed(null);
    setErrorMsg('');
    setEstado('camara');
  };

  const releerMismaFoto = () => {
    if (!fotoBlob) return;
    void leerDesdeFoto(fotoBlob);
  };

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const subtitulo = (() => {
    switch (estado) {
      case 'camara':
        return 'Ubicá el código dentro del recuadro y sacá la foto';
      case 'decodificando':
        return 'Leyendo el código desde la foto capturada';
      case 'parseado':
        return 'Revisá los datos detectados';
      case 'sin_codigo':
        return 'No se detectó el código en la foto';
    }
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

      {estado === 'camara' && (
        <CamaraSoloParaSacarFoto
          onPhoto={guardarFotoYLeer}
          onNativePhoto={cargarFotoNativa}
        />
      )}

      {(estado === 'decodificando' || estado === 'sin_codigo') && fotoUrl && (
        <FotoCapturada
          estado={estado}
          fotoUrl={fotoUrl}
          errorMsg={errorMsg}
          onRetry={reintentar}
          onReadAgain={releerMismaFoto}
          onNativePhoto={cargarFotoNativa}
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
              onClick={reintentar}
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

// ============================================================================
//  Cámara SOLO como visor para sacar una foto.
//  No hay lectura en vivo del stream.
// ============================================================================

function CamaraSoloParaSacarFoto({
  onPhoto,
  onNativePhoto,
}: {
  onPhoto: (blob: Blob) => void;
  onNativePhoto: (file: File | undefined) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativePhotoInputRef = useRef<HTMLInputElement>(null);

  const [iniciando, setIniciando] = useState(true);
  const [tomandoFoto, setTomandoFoto] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [videoRes, setVideoRes] = useState('—');
  const [photoRes, setPhotoRes] = useState('');

  useEffect(() => {
    let stopped = false;

    const stop = () => {
      stopped = true;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
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

        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();

        setVideoRes(`${settings.width || '?'}×${settings.height || '?'}`);

        await aplicarMejorasDeCamara(track);
        await detectarResolucionDeFoto(track, setPhotoRes);

        setIniciando(false);
      } catch (e) {
        if (!stopped) {
          setCameraError((e as Error)?.message || 'No se pudo acceder a la cámara.');
          setIniciando(false);
        }
      }
    };

    void start();

    return stop;
  }, []);

  const capturarFoto = async () => {
    const video = videoRef.current;
    const track = streamRef.current?.getVideoTracks()[0];

    if (!video || !track || tomandoFoto) return;

    setTomandoFoto(true);
    setCameraError('');

    try {
      const blob = await sacarFoto(track, video);

      // Cerramos la cámara apenas tenemos la foto.
      // Desde este punto, la lectura ya no depende de la cámara.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      onPhoto(blob);
    } catch (e) {
      setCameraError((e as Error)?.message || 'No se pudo sacar la foto.');
      setTomandoFoto(false);
    }
  };

  const disabled = iniciando || tomandoFoto || !!cameraError;

  return (
    <>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="relative w-[92%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
          <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-green-400" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-green-400" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-green-400" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-green-400" />

          <div className="absolute -top-8 left-0 right-0 text-center text-white text-xs font-semibold">
            Alineá el código PDF417 dentro del recuadro
          </div>
        </div>

        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded leading-tight">
          <div>Video: {videoRes}</div>
          {photoRes && <div>Foto: {photoRes}</div>}
        </div>

        <div className="absolute bottom-3 left-0 right-0 text-center text-sm font-medium px-4 pointer-events-none">
          {iniciando && <span className="text-white/80">Iniciando cámara…</span>}

          {!iniciando && !cameraError && !tomandoFoto && (
            <span className="text-white/85 bg-black/45 px-3 py-1.5 rounded-lg inline-block">
              La cámara solo enfoca. Al tocar el botón se saca una foto y se lee desde esa imagen.
            </span>
          )}

          {tomandoFoto && (
            <span className="text-white bg-black/70 px-3 py-1.5 rounded-lg">
              Sacando foto…
            </span>
          )}

          {cameraError && (
            <span className="text-rose-300 bg-black/70 px-3 py-1.5 rounded-lg">
              {cameraError}
            </span>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0 space-y-2">
        <input
          ref={nativePhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onNativePhoto(e.target.files?.[0]);
            e.currentTarget.value = '';
          }}
        />

        <button
          onClick={capturarFoto}
          disabled={disabled}
          className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
        >
          📸 Sacar foto y leer
        </button>

        <button
          type="button"
          onClick={() => nativePhotoInputRef.current?.click()}
          disabled={tomandoFoto}
          className="w-full py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15 disabled:opacity-50"
        >
          Usar cámara nativa / elegir foto
        </button>
      </div>
    </>
  );
}

function FotoCapturada({
  estado,
  fotoUrl,
  errorMsg,
  onRetry,
  onReadAgain,
  onNativePhoto,
}: {
  estado: Estado;
  fotoUrl: string;
  errorMsg: string;
  onRetry: () => void;
  onReadAgain: () => void;
  onNativePhoto: (file: File | undefined) => void;
}) {
  const nativePhotoInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotoUrl}
          alt="Foto capturada del código de barras"
          className="absolute w-full h-full object-contain"
        />

        <div className="absolute inset-0 bg-black/15 pointer-events-none" />

        <div className="absolute top-3 left-3 right-3 text-center pointer-events-none">
          {estado === 'decodificando' && (
            <span className="text-white bg-black/70 px-3 py-1.5 rounded-lg text-sm font-medium">
              Foto tomada. Leyendo el código desde esta imagen…
            </span>
          )}

          {estado === 'sin_codigo' && (
            <span className="text-white bg-amber-500/95 px-3 py-1.5 rounded-lg text-sm font-medium max-w-[92%] inline-block">
              {errorMsg}
            </span>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0 space-y-2">
        <input
          ref={nativePhotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onNativePhoto(e.target.files?.[0]);
            e.currentTarget.value = '';
          }}
        />

        {estado === 'decodificando' && (
          <button
            disabled
            className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg opacity-60"
          >
            Leyendo desde la foto…
          </button>
        )}

        {estado === 'sin_codigo' && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRetry}
              className="py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700"
            >
              Sacar otra foto
            </button>

            <button
              onClick={onReadAgain}
              className="py-3.5 rounded-lg bg-white/10 text-white font-bold text-sm ring-1 ring-white/20 active:bg-white/15"
            >
              Releer esta foto
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => nativePhotoInputRef.current?.click()}
          disabled={estado === 'decodificando'}
          className="w-full py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15 disabled:opacity-50"
        >
          Usar cámara nativa / elegir foto
        </button>
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

async function aplicarMejorasDeCamara(track: MediaStreamTrack) {
  try {
    const caps = (track.getCapabilities?.() ?? {}) as CameraCapabilities;
    const advanced: Array<Record<string, string | number>> = [];

    if (caps.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }

    if (caps.zoom && caps.zoom.max > (caps.zoom.min || 1)) {
      advanced.push({ zoom: Math.min(2, caps.zoom.max) });
    }

    if (advanced.length) {
      await track.applyConstraints({
        advanced: advanced as MediaTrackConstraintSet[],
      });
    }
  } catch {
    // Si el navegador no soporta foco/zoom por constraints, seguimos igual.
  }
}

async function detectarResolucionDeFoto(
  track: MediaStreamTrack,
  setPhotoRes: (value: string) => void,
) {
  const ImageCaptureClass = obtenerImageCapture();
  if (!ImageCaptureClass) return;

  try {
    const imageCapture = new ImageCaptureClass(track);
    const caps = await imageCapture.getPhotoCapabilities?.();

    if (caps?.imageWidth?.max && caps?.imageHeight?.max) {
      setPhotoRes(`${caps.imageWidth.max}×${caps.imageHeight.max}`);
    }
  } catch {
    // Solo diagnóstico visual; no bloquea el flujo.
  }
}

async function sacarFoto(track: MediaStreamTrack, video: HTMLVideoElement): Promise<Blob> {
  const ImageCaptureClass = obtenerImageCapture();

  if (ImageCaptureClass) {
    try {
      const imageCapture = new ImageCaptureClass(track);
      const caps = await imageCapture.getPhotoCapabilities?.();

      const settings =
        caps?.imageWidth?.max && caps?.imageHeight?.max
          ? {
              imageWidth: caps.imageWidth.max,
              imageHeight: caps.imageHeight.max,
            }
          : undefined;

      return await imageCapture.takePhoto(settings);
    } catch (e) {
      console.debug('[ImageCapture] falló; se usa frame del video como foto', e);
    }
  }

  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('La cámara todavía no está lista para sacar la foto.');
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

function obtenerImageCapture(): ImageCaptureConstructor | null {
  const maybeWindow = window as Window & {
    ImageCapture?: ImageCaptureConstructor;
  };

  return maybeWindow.ImageCapture ?? null;
}

async function decodificarImagen(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);

  try {
    const reader = new BrowserPDF417Reader();

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.TRY_HARDER, true);

    (reader as BrowserPDF417Reader & { hints?: Map<DecodeHintType, unknown> }).hints = hints;

    const result = await reader.decodeFromImageUrl(url);

    return result.getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function crearVariantesParaPdf417(blob: Blob): Promise<ImageVariant[]> {
  const img = await cargarImagen(blob);

  const variants: ImageVariant[] = [];

  // Como el usuario alinea el PDF417 en el recuadro horizontal,
  // probamos primero recortes centrales de la foto capturada.
  variants.push({
    label: 'recorte guía 92%',
    blob: await renderVariant(img, {
      cropWidthRatio: 0.92,
      aspect: 3,
    }),
  });

  variants.push({
    label: 'recorte guía 78%',
    blob: await renderVariant(img, {
      cropWidthRatio: 0.78,
      aspect: 3,
    }),
  });

  variants.push({
    label: 'recorte guía contrastado',
    blob: await renderVariant(img, {
      cropWidthRatio: 0.92,
      aspect: 3,
      enhance: true,
    }),
  });

  // Fallbacks por si el código quedó fuera del recorte.
  variants.push({
    label: 'foto completa',
    blob,
  });

  variants.push({
    label: 'foto completa normalizada',
    blob: await renderVariant(img, {
      fullImage: true,
    }),
  });

  return variants;
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
      reject(new Error('No se pudo cargar la foto capturada.'));
    };

    img.src = url;
  });
}

async function renderVariant(
  img: HTMLImageElement,
  options: {
    cropWidthRatio?: number;
    aspect?: number;
    enhance?: boolean;
    fullImage?: boolean;
  },
): Promise<Blob> {
  const sourceW = img.naturalWidth || img.width;
  const sourceH = img.naturalHeight || img.height;

  let sx = 0;
  let sy = 0;
  let sw = sourceW;
  let sh = sourceH;

  if (!options.fullImage) {
    const aspect = options.aspect ?? 3;
    const desiredW = sourceW * (options.cropWidthRatio ?? 0.92);
    const desiredH = desiredW / aspect;

    if (desiredH <= sourceH * 0.75) {
      sw = desiredW;
      sh = desiredH;
    } else {
      sh = sourceH * 0.6;
      sw = sh * aspect;
    }

    sx = Math.max(0, (sourceW - sw) / 2);
    sy = Math.max(0, (sourceH - sh) / 2);
  }

  const targetW = Math.min(2400, Math.max(1200, Math.round(sw)));
  const targetH = Math.max(350, Math.round(targetW * (sh / sw)));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', {
    willReadFrequently: !!options.enhance,
  });

  if (!ctx) {
    throw new Error('No se pudo preparar la imagen para leer el código.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

  if (options.enhance) {
    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));

      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  return canvasToBlob(canvas, 'image/jpeg', 0.95);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo generar la foto para leer el código.'));
        }
      },
      type,
      quality,
    );
  });
}

function esNotFoundException(e: unknown) {
  return e instanceof NotFoundException || (e as { name?: string })?.name === 'NotFoundException';
}