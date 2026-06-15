// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Lector PDF417 del DNI usando ZXing. Funciona dentro del navegador, sin
//  servicios externos. Despues de leer, muestra un panel con los datos
//  parseados para que el usuario los revise antes de aplicarlos al formulario.
// ============================================================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
  NotFoundException,
  PDF417Reader,
  type Result,
} from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type ZoomControl = {
  min: number;
  max: number;
  step: number;
  value: number;
};

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const decodificandoRef = useRef(false);
  const activoRef = useRef(true);
  const [estado, setEstado] = useState<'iniciando' | 'escaneando' | 'parseado' | 'error'>('iniciando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [intentos, setIntentos] = useState(0);
  const [torchDisponible, setTorchDisponible] = useState(false);
  const [torchActivo, setTorchActivo] = useState(false);
  const [leyendoFoto, setLeyendoFoto] = useState(false);
  const [zoomControl, setZoomControl] = useState<ZoomControl | null>(null);
  const [enfoqueMsg, setEnfoqueMsg] = useState('');

  const aplicarResultado = useCallback((raw: string) => {
    const p = parseDniPdf417(raw);
    setParsed(p);
    setEstado('parseado');
    setLeyendoFoto(false);
    detenerEscaneo(timerRef, streamRef);
  }, []);

  const intentarLeerFrame = useCallback(async (mostrarError: boolean) => {
    const video = videoRef.current;
    const marco = marcoRef.current;
    if (!video || !marco || video.readyState < 2 || decodificandoRef.current) return;

    decodificandoRef.current = true;
    setIntentos(prev => prev + 1);

    try {
      const raw = await decodificarCanvas(capturarMarco(video, marco));
      aplicarResultado(raw);
    } catch (e: any) {
      if (mostrarError) {
        setErrorMsg('No pude leer el codigo en esa toma. Acercalo, mejora la luz y proba de nuevo.');
      }
      if (!(e instanceof NotFoundException) && mostrarError) {
        console.debug('[ZXing canvas]', e);
      }
    } finally {
      decodificandoRef.current = false;
    }
  }, [aplicarResultado]);

  useEffect(() => {
    activoRef.current = true;

    (async () => {
      try {
        await iniciarCamara(videoRef.current, streamRef, setTorchDisponible, setZoomControl, setEnfoqueMsg);
        if (!activoRef.current) return;
        setEstado('escaneando');
        timerRef.current = window.setInterval(() => {
          void intentarLeerFrame(false);
        }, 320);
      } catch (e: any) {
        if (!activoRef.current) return;
        setErrorMsg(e?.message || 'No se pudo acceder a la camara.');
        setEstado('error');
      }
    })();

    return () => {
      activoRef.current = false;
      detenerEscaneo(timerRef, streamRef);
    };
  }, [intentarLeerFrame]);

  const reiniciar = () => {
    detenerEscaneo(timerRef, streamRef);
    setParsed(null);
    setEstado('iniciando');
    setErrorMsg('');
    setIntentos(0);
    setTorchActivo(false);
    setLeyendoFoto(false);
    setZoomControl(null);
    setEnfoqueMsg('');

    iniciarCamara(videoRef.current, streamRef, setTorchDisponible, setZoomControl, setEnfoqueMsg).then(() => {
      setEstado('escaneando');
      timerRef.current = window.setInterval(() => {
        void intentarLeerFrame(false);
      }, 320);
    }).catch((e: any) => {
      setErrorMsg(e?.message || 'No se pudo acceder a la camara.');
      setEstado('error');
    });
  };

  const cambiarLinterna = async () => {
    const track = obtenerVideoTrack(videoRef.current);
    if (!track) return;

    const siguiente = !torchActivo;
    try {
      await track.applyConstraints({ advanced: [{ torch: siguiente }] as any });
      setTorchActivo(siguiente);
    } catch {
      setTorchDisponible(false);
    }
  };

  const enfocarDesdeToque = async (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button,input')) return;

    const video = videoRef.current;
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    await enfocarCamara(video, { x, y }, setEnfoqueMsg);
  };

  const enfocarCentro = async () => {
    await enfocarCamara(videoRef.current, { x: 0.5, y: 0.5 }, setEnfoqueMsg);
  };

  const cambiarZoom = async (value: number) => {
    const track = obtenerVideoTrack(videoRef.current);
    if (!track || !zoomControl) return;

    try {
      await track.applyConstraints({ advanced: [{ zoom: value }] as any });
      setZoomControl({ ...zoomControl, value });
      setEnfoqueMsg('Zoom ajustado. Mantené el DNI un poco más lejos para que enfoque.');
    } catch {
      setEnfoqueMsg('Esta cámara no permitió ajustar el zoom.');
    }
  };

  const leerDesdeFoto = async () => {
    setLeyendoFoto(true);
    setErrorMsg('');
    try {
      await intentarLeerFrame(true);
    } finally {
      setLeyendoFoto(false);
    }
  };

  const aplicar = () => {
    if (!parsed) return;
    const campos = parsedDniToFormFields(parsed);
    onApply(campos, parsed);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10">
        <div>
          <h3 className="font-bold text-lg">Escanear codigo del DNI</h3>
          <p className="text-xs text-white/60 mt-0.5">Apunta al codigo de barras del dorso (PDF417)</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm">Cerrar</button>
      </div>

      <div
        onPointerDown={(e) => void enfocarDesdeToque(e)}
        className={`flex-1 relative overflow-hidden flex items-center justify-center ${estado === 'parseado' ? 'hidden' : ''}`}
      >
        <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        <div ref={marcoRef} className="relative w-[94%] max-w-3xl aspect-[3.8/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
        </div>

        <div className={`${zoomControl ? 'bottom-40' : 'bottom-28'} absolute left-0 right-0 text-center text-white/80 text-sm font-medium px-4`}>
          {estado === 'iniciando' && 'Iniciando camara...'}
          {estado === 'escaneando' && `Mantene el codigo nitido, horizontal y ocupando el recuadro (${intentos} intentos)`}
          {estado === 'error' && <span className="text-rose-300">{errorMsg}</span>}
          {estado === 'escaneando' && errorMsg && <div className="mt-2 text-amber-200">{errorMsg}</div>}
          {estado === 'escaneando' && enfoqueMsg && <div className="mt-2 text-emerald-200">{enfoqueMsg}</div>}
        </div>

        {zoomControl && (
          <div className="absolute bottom-24 left-4 right-4 mx-auto max-w-sm rounded-lg bg-black/45 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-white/80">Zoom</span>
              <input
                type="range"
                min={zoomControl.min}
                max={zoomControl.max}
                step={zoomControl.step}
                value={zoomControl.value}
                onChange={(e) => void cambiarZoom(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>
        )}

        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 px-4">
          <button
            type="button"
            onClick={() => void enfocarCentro()}
            className="px-4 py-3 rounded-lg bg-white/15 text-white ring-1 ring-white/30 font-semibold text-sm backdrop-blur"
          >
            Enfocar
          </button>
          {torchDisponible && (
            <button
              type="button"
              onClick={cambiarLinterna}
              className="px-4 py-3 rounded-lg bg-white/15 text-white ring-1 ring-white/30 font-semibold text-sm backdrop-blur"
            >
              {torchActivo ? 'Apagar luz' : 'Luz'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void leerDesdeFoto()}
            disabled={leyendoFoto || estado !== 'escaneando'}
            className="px-4 py-3 rounded-lg bg-white text-slate-900 font-semibold text-sm disabled:opacity-60"
          >
            {leyendoFoto ? 'Leyendo...' : 'Leer desde foto'}
          </button>
        </div>
      </div>

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
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Ver texto crudo del codigo</summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">{parsed.raw}</pre>
              </details>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full">
            <button
              onClick={reiniciar}
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

      {estado === 'error' && (
        <div className="h-32 bg-black flex items-center justify-center gap-3 px-4">
          <button onClick={reiniciar} className="flex-1 max-w-xs py-3 bg-white text-slate-900 font-semibold rounded-lg">Reintentar</button>
          <button onClick={onClose} className="flex-1 max-w-xs py-3 bg-gray-700 text-white font-semibold rounded-lg">Cerrar</button>
        </div>
      )}
    </div>
  );
}

function getCameraConstraints(): MediaStreamConstraints {
  return {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 2560 },
      height: { ideal: 1440 },
      frameRate: { ideal: 30 },
    },
  };
}

async function iniciarCamara(
  video: HTMLVideoElement | null,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setTorchDisponible: (disponible: boolean) => void,
  setZoomControl: (zoom: ZoomControl | null) => void,
  setEnfoqueMsg: (msg: string) => void
) {
  if (!video) throw new Error('No se encontro el video de camara.');

  const stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints());
  streamRef.current = stream;
  video.srcObject = stream;
  await video.play();

  const track = obtenerVideoTrack(video);
  if (!track) return;

  const capabilities = (track.getCapabilities?.() || {}) as any;
  const settings = (track.getSettings?.() || {}) as any;
  setTorchDisponible(Boolean(capabilities.torch));
  configurarZoom(capabilities, settings, setZoomControl);

  await enfocarCamara(video, { x: 0.5, y: 0.5 }, setEnfoqueMsg, false);
}

function detenerEscaneo(
  timerRef: React.MutableRefObject<number | null>,
  streamRef: React.MutableRefObject<MediaStream | null>
) {
  if (timerRef.current) {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  streamRef.current?.getTracks().forEach(track => track.stop());
  streamRef.current = null;
}

function obtenerVideoTrack(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
  return stream?.getVideoTracks()[0] || null;
}

async function enfocarCamara(
  video: HTMLVideoElement | null,
  punto: { x: number; y: number },
  setEnfoqueMsg: (msg: string) => void,
  mostrarMensaje = true
) {
  const track = obtenerVideoTrack(video);
  if (!track) return;

  const capabilities = (track.getCapabilities?.() || {}) as any;
  const focusModes: string[] = capabilities.focusMode || [];
  const advanced: any[] = [];

  if (focusModes.includes('single-shot')) {
    advanced.push({ focusMode: 'single-shot', pointsOfInterest: [punto] });
  }

  if (focusModes.includes('continuous')) {
    advanced.push({ focusMode: 'continuous', pointsOfInterest: [punto] });
  }

  advanced.push({ exposureMode: 'continuous', pointsOfInterest: [punto] });

  try {
    await track.applyConstraints({ advanced } as any);
    if (mostrarMensaje) {
      setEnfoqueMsg('Enfoque solicitado. Si se ve borroso, aleja un poco el DNI y toca de nuevo.');
    }
  } catch {
    if (mostrarMensaje) {
      setEnfoqueMsg('Esta cámara no permite controlar el foco desde la web. Aleja un poco el DNI y usa zoom.');
    }
  }
}

function configurarZoom(
  capabilities: any,
  settings: any,
  setZoomControl: (zoom: ZoomControl | null) => void
) {
  if (typeof capabilities.zoom !== 'object') {
    setZoomControl(null);
    return;
  }

  const min = Number(capabilities.zoom.min ?? 1);
  const max = Number(capabilities.zoom.max ?? 1);
  const step = Number(capabilities.zoom.step ?? 0.1);
  const value = Number(settings.zoom ?? min);

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    setZoomControl(null);
    return;
  }

  setZoomControl({ min, max, step, value });
}

function capturarMarco(video: HTMLVideoElement, marco: HTMLDivElement): HTMLCanvasElement {
  const videoRect = video.getBoundingClientRect();
  const marcoRect = marco.getBoundingClientRect();

  const scaleX = video.videoWidth / videoRect.width;
  const scaleY = video.videoHeight / videoRect.height;
  const margenX = marcoRect.width * 0.08;
  const margenY = marcoRect.height * 0.18;

  const sx = Math.max(0, (marcoRect.left - videoRect.left - margenX) * scaleX);
  const sy = Math.max(0, (marcoRect.top - videoRect.top - margenY) * scaleY);
  const sWidth = Math.min(video.videoWidth - sx, (marcoRect.width + margenX * 2) * scaleX);
  const sHeight = Math.min(video.videoHeight - sy, (marcoRect.height + margenY * 2) * scaleY);

  const minWidth = 1600;
  const upscale = sWidth < minWidth ? minWidth / sWidth : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sWidth * upscale));
  canvas.height = Math.max(1, Math.round(sHeight * upscale));

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  return mejorarContraste(canvas);
}

function mejorarContraste(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;

  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.filter = 'grayscale(100%) contrast(1.8) brightness(1.08)';
  ctx.drawImage(canvas, 0, 0);
  return out;
}

async function decodificarCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const nativeResult = await decodificarConBarcodeDetector(canvas);
  if (nativeResult) return nativeResult;

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const source = new HTMLCanvasElementLuminanceSource(canvas, true);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const result: Result = new PDF417Reader().decode(bitmap, hints);
  return result.getText();
}

async function decodificarConBarcodeDetector(canvas: HTMLCanvasElement): Promise<string | null> {
  const Detector = (window as any).BarcodeDetector;
  if (!Detector) return null;

  try {
    const formats = typeof Detector.getSupportedFormats === 'function'
      ? await Detector.getSupportedFormats()
      : ['pdf417'];

    if (!formats.includes('pdf417')) return null;

    const detector = new Detector({ formats: ['pdf417'] });
    const barcodes = await detector.detect(canvas);
    const match = barcodes.find((barcode: any) => barcode.rawValue);
    return match?.rawValue || null;
  } catch {
    return null;
  }
}

function Row({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm text-slate-900 ${mono ? 'tnum font-mono' : 'font-medium'} ${value ? '' : 'text-slate-400 italic'}`}>
        {value || '-'}
      </dd>
    </div>
  );
}
