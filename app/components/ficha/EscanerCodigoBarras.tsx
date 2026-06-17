// ============================================================================
// app/components/ficha/EscanerCodigoBarras.tsx
//
// Flujo correcto para este caso:
// 1) NO usa cámara en vivo.
// 2) Abre la cámara nativa / selector de imagen.
// 3) El usuario saca una foto real.
// 4) La app muestra esa foto.
// 5) El usuario marca con el dedo/mouse la zona exacta del PDF417.
// 6) ZXing lee únicamente ese recorte.
// ============================================================================
'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BarcodeFormat,
  BrowserPDF417Reader,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';
import {
  parseDniPdf417,
  parsedDniToFormFields,
  type ParsedDni,
} from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'inicial' | 'seleccionar' | 'leyendo' | 'parseado';

type Crop = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const CROP_INICIAL: Crop = {
  x: 0.08,
  y: 0.52,
  w: 0.84,
  h: 0.24,
};

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fotoUrlRef = useRef('');

  const [estado, setEstado] = useState<Estado>('inicial');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoUrl, setFotoUrl] = useState('');
  const [crop, setCrop] = useState<Crop>(CROP_INICIAL);
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      if (fotoUrlRef.current) {
        URL.revokeObjectURL(fotoUrlRef.current);
      }
    };
  }, []);

  const abrirCamaraNativa = () => {
    inputRef.current?.click();
  };

  const recibirFoto = (file: File | undefined) => {
    if (!file) return;

    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    fotoUrlRef.current = url;

    setFotoBlob(file);
    setFotoUrl(url);
    setCrop(CROP_INICIAL);
    setParsed(null);
    setErrorMsg('');
    setEstado('seleccionar');
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
      console.error('[DNI PDF417] No se pudo leer el recorte', e);

      if (esNotFoundException(e)) {
        setErrorMsg(
          'No se pudo leer el código. Marcá solamente el código PDF417, sin mucho DNI alrededor, y probá de nuevo.',
        );
      } else {
        setErrorMsg((e as Error)?.message || 'No se pudo leer el código.');
      }

      setEstado('seleccionar');
    }
  };

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const subtitulo = (() => {
    if (estado === 'inicial') return 'Sacá una foto del código PDF417 del DNI';
    if (estado === 'seleccionar') return 'Marcá la zona exacta del código en la foto';
    if (estado === 'leyendo') return 'Leyendo solo el recorte marcado';
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

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          recibirFoto(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />

      {estado === 'inicial' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-white">
          <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center mb-5">
            <span className="text-3xl">📸</span>
          </div>

          <h4 className="text-lg font-bold mb-2">Sacar foto del código</h4>

          <p className="text-sm text-white/70 max-w-sm mb-6">
            Se va a abrir la cámara del teléfono. Sacá una foto del dorso del DNI. Después vas a
            marcar con el dedo la zona donde está el código de barras PDF417.
          </p>

          <button
            type="button"
            onClick={abrirCamaraNativa}
            className="w-full max-w-sm py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700"
          >
            Sacar foto
          </button>

          <button
            type="button"
            onClick={abrirCamaraNativa}
            className="w-full max-w-sm mt-3 py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15"
          >
            Elegir foto existente
          </button>
        </div>
      )}

      {(estado === 'seleccionar' || estado === 'leyendo') && fotoUrl && (
        <SeleccionarZona
          fotoUrl={fotoUrl}
          crop={crop}
          setCrop={setCrop}
          leyendo={estado === 'leyendo'}
          errorMsg={errorMsg}
          onLeer={leerZonaMarcada}
          onNuevaFoto={abrirCamaraNativa}
        />
      )}

      {estado === 'parseado' && parsed && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-auto">
          <div className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
            {fotoUrl && (
              <div className="mb-4 bg-black rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoUrl}
                  alt="Foto leída correctamente"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

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
              onClick={abrirCamaraNativa}
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

function SeleccionarZona({
  fotoUrl,
  crop,
  setCrop,
  leyendo,
  errorMsg,
  onLeer,
  onNuevaFoto,
}: {
  fotoUrl: string;
  crop: Crop;
  setCrop: (crop: Crop) => void;
  leyendo: boolean;
  errorMsg: string;
  onLeer: () => void;
  onNuevaFoto: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const puntoRelativo = (event: ReactPointerEvent<HTMLDivElement>) => {
    const area = areaRef.current;
    if (!area) return null;

    const rect = area.getBoundingClientRect();

    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const empezar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (leyendo) return;

    const punto = puntoRelativo(event);
    if (!punto) return;

    startRef.current = punto;
    event.currentTarget.setPointerCapture(event.pointerId);

    setCrop({
      x: punto.x,
      y: punto.y,
      w: 0.01,
      h: 0.01,
    });
  };

  const mover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current || leyendo) return;

    const punto = puntoRelativo(event);
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

  const terminar = (event: ReactPointerEvent<HTMLDivElement>) => {
    startRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // No todos los navegadores lo necesitan.
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
            className="block max-w-full max-h-[calc(100vh-205px)] select-none touch-none"
          />

          <div
            ref={areaRef}
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
              Leyendo solo la zona marcada…
            </span>
          ) : errorMsg ? (
            <span className="text-white bg-amber-500/95 px-3 py-2 rounded-lg text-xs font-medium inline-block max-w-[96%]">
              {errorMsg}
            </span>
          ) : (
            <span className="text-white bg-black/65 px-3 py-2 rounded-lg text-xs font-medium inline-block max-w-[96%]">
              Arrastrá sobre el código PDF417 para marcarlo. El recuadro verde es lo único que se
              va a leer.
            </span>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0 space-y-2">
        <button
          type="button"
          onClick={onLeer}
          disabled={leyendo}
          className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
        >
          {leyendo ? 'Leyendo recorte…' : 'Escanear zona marcada'}
        </button>

        <button
          type="button"
          onClick={onNuevaFoto}
          disabled={leyendo}
          className="w-full py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15 disabled:opacity-50"
        >
          Sacar otra foto / elegir foto
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

async function crearRecortesParaLeer(blob: Blob, crop: Crop): Promise<Blob[]> {
  const img = await cargarImagen(blob);
  const zona = normalizarCrop(crop);

  return [
    await recortarImagen(img, zona, { margen: 0, contraste: false, escala: 1 }),
    await recortarImagen(img, zona, { margen: 0, contraste: true, escala: 1 }),
    await recortarImagen(img, zona, { margen: 0.04, contraste: false, escala: 1 }),
    await recortarImagen(img, zona, { margen: 0.04, contraste: true, escala: 1 }),
    await recortarImagen(img, zona, { margen: 0.08, contraste: false, escala: 1.2 }),
    await recortarImagen(img, zona, { margen: 0.08, contraste: true, escala: 1.2 }),
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
  options: { margen: number; contraste: boolean; escala: number },
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

  const baseTargetW = Math.min(3200, Math.max(1400, sw));
  const targetW = Math.round(baseTargetW * options.escala);
  const targetH = Math.max(280, Math.round(targetW * (sh / sw)));

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
      const contrasted = clamp((gray - 128) * 1.65 + 128, 0, 255);

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
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
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