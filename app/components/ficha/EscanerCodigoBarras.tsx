// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Modal de recorte + decodificación PDF417. Recibe la foto ya tomada (la
//  cámara la abrió el banner de FichaForm directamente). Muestra el cropper,
//  el usuario ajusta el recuadro, y decodificamos esa región.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  BrowserPDF417Reader,
  PDF417Reader,
  BinaryBitmap,
  HybridBinarizer,
  HTMLCanvasElementLuminanceSource,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'escaneando' | 'recortando' | 'decodificando' | 'parseado' | 'sin_codigo';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>('escaneando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Cleanup del blob URL cuando se reemplaza o el componente se cierra
  useEffect(() => {
    return () => { if (imgUrl) URL.revokeObjectURL(imgUrl); };
  }, [imgUrl]);

  // Cuando el live-scan detectó un código (raw string del PDF417)
  const onDecodedFromLive = (raw: string) => {
    const p = parseDniPdf417(raw);
    setParsed(p);
    setEstado('parseado');
  };

  // Cuando el live-scan o el cropper sacan una foto (manual) → ir a cropper
  const onPhotoTaken = (file: File) => {
    setImgUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setParsed(null);
    setErrorMsg('');
    setEstado('recortando');
  };

  const decodificarCanvas = async (canvas: HTMLCanvasElement) => {
    setEstado('decodificando');
    const dataUrl = canvas.toDataURL('image/png');
    try {
      const reader = new BrowserPDF417Reader();
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      (reader as any).hints = hints;
      const result = await reader.decodeFromImageUrl(dataUrl);
      const raw = result.getText();
      const p = parseDniPdf417(raw);
      setParsed(p);
      setEstado('parseado');
    } catch (e) {
      if (e instanceof NotFoundException) {
        setErrorMsg('No se detectó código en el área recortada. Ajustá el recuadro al PDF417 (rectángulo de barras finas) y reintentá.');
        setEstado('sin_codigo');
      } else {
        setErrorMsg((e as any)?.message || 'Error al decodificar.');
        setEstado('sin_codigo');
      }
    }
  };

  const aplicar = () => {
    if (!parsed) return;
    onApply(parsedDniToFormFields(parsed), parsed);
  };

  const volverARecorte = () => {
    setParsed(null);
    setErrorMsg('');
    setEstado('recortando');
  };

  const subtitulo = (() => {
    switch (estado) {
      case 'escaneando':    return 'Buscando código en vivo… o sacá una foto';
      case 'recortando':    return 'Ajustá el recuadro al código de barras (PDF417)';
      case 'decodificando': return 'Decodificando…';
      case 'parseado':      return 'Revisá los datos detectados';
      case 'sin_codigo':    return 'Ajustá el recuadro y reintentá';
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

      {estado === 'escaneando' && (
        <LiveScan onDecoded={onDecodedFromLive} onTakePhoto={onPhotoTaken} />
      )}

      {(estado === 'recortando' || estado === 'decodificando' || estado === 'sin_codigo') && imgUrl && (
        <Cropper
          imgUrl={imgUrl}
          disabled={estado === 'decodificando'}
          decodingState={estado}
          errorMsg={errorMsg}
          onDecode={decodificarCanvas}
          onRetakeFile={onPhotoTaken}
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
              onClick={volverARecorte}
              className="flex-1 py-3 rounded-lg bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Ajustar recorte
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
//  LiveScan: cámara en vivo con loop de decode automático sobre frames.
//  Usa el decoder de bajo nivel (PDF417Reader + HTMLCanvasElementLuminanceSource)
//  para evitar el roundtrip por dataURL. Si en X intentos no engancha, el usuario
//  tiene un botón siempre visible para sacar una foto y pasar al cropper.
// ============================================================================

function LiveScan({
  onDecoded, onTakePhoto,
}: {
  onDecoded: (raw: string) => void;
  onTakePhoto: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [intentos, setIntentos] = useState(0);
  const [videoRes, setVideoRes] = useState<string>('—');
  const [errorMsg, setErrorMsg] = useState('');
  const [iniciando, setIniciando] = useState(true);

  useEffect(() => {
    let stopped = false;
    let timeoutId: number | undefined;

    const stop = () => {
      stopped = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
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

        // Autofocus continuo + zoom moderado si el dispositivo lo permite
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

        setIniciando(false);

        // Decoder de bajo nivel (sincrónico, sin dataURL)
        const reader = new PDF417Reader();
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { setErrorMsg('Canvas 2D no disponible.'); return; }

        let count = 0;
        const tick = () => {
          if (stopped) return;
          const v = videoRef.current;
          if (!v || v.videoWidth === 0) {
            timeoutId = window.setTimeout(tick, 200);
            return;
          }
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          ctx.drawImage(v, 0, 0);

          try {
            const luminance = new HTMLCanvasElementLuminanceSource(canvas);
            const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
            const result = reader.decode(bitmap, hints);
            if (!stopped) {
              stop();
              onDecoded(result.getText());
            }
            return;
          } catch (e) {
            if (!(e instanceof NotFoundException)) {
              // Otros errores (ChecksumException, FormatException): seguimos intentando
            }
          }
          count++;
          if (count % 2 === 0) setIntentos(count);
          timeoutId = window.setTimeout(tick, 300);
        };
        tick();
      } catch (e: any) {
        if (!stopped) {
          setErrorMsg(e?.message || 'No se pudo acceder a la cámara.');
          setIniciando(false);
        }
      }
    };

    start();
    return stop;
  }, [onDecoded]);

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onTakePhoto(f);
    e.target.value = '';
  };

  return (
    <>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0 bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        {/* Marco para el PDF417 */}
        <div className="relative w-[92%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none">
          <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-green-400" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-green-400" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-green-400" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-green-400" />
        </div>

        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded">
          {videoRes}
        </div>

        <div className="absolute bottom-3 left-0 right-0 text-center text-white text-sm font-medium px-4 pointer-events-none">
          {iniciando && 'Iniciando cámara…'}
          {!iniciando && !errorMsg && (
            <span className="text-white/85">
              Buscando código… <span className="text-white/55">({intentos})</span>
            </span>
          )}
          {errorMsg && <span className="text-rose-300">{errorMsg}</span>}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0">
        <label className="block w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg text-center cursor-pointer active:bg-emerald-700">
          📸 Sacar foto del código
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPhotoChange}
          />
        </label>
        <p className="text-[11px] text-white/50 text-center mt-2">
          Si no detecta automáticamente, sacá una foto y recortás el código.
        </p>
      </div>
    </>
  );
}

// ============================================================================
//  Cropper: imagen + recuadro arrastrable + redimensionable
//  La clave del fix: el recuadro se posiciona dentro de un div que tiene
//  EXACTAMENTE las dimensiones de la imagen mostrada, no del wrapper externo.
//  Antes el div externo tenía letterbox (espacio negro) y el recuadro estaba
//  limitado al área del IMG, pero el IMG no llenaba el wrapper → "sector".
// ============================================================================

type Box = { x: number; y: number; w: number; h: number };  // en coords del display
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type DragMode = 'move' | Corner;

function Cropper({
  imgUrl, disabled, decodingState, errorMsg, onDecode, onRetakeFile,
}: {
  imgUrl: string;
  disabled: boolean;
  decodingState: Estado;
  errorMsg: string;
  onDecode: (canvas: HTMLCanvasElement) => void;
  onRetakeFile: (file: File) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displayed, setDisplayed] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const dragInfo = useRef<{ mode: DragMode; px: number; py: number; box: Box } | null>(null);

  // Calcula el tamaño real de la imagen mostrada (object-contain style),
  // luego inicializa o ajusta el recuadro manteniendo proporciones.
  const recalcular = (preservarBox = false) => {
    const img = imgRef.current;
    const wrap = wrapperRef.current;
    if (!img || !wrap || !img.naturalWidth) return;

    const wRect = wrap.getBoundingClientRect();
    const aspect = img.naturalWidth / img.naturalHeight;
    let w: number, h: number;
    if (wRect.width / aspect <= wRect.height) {
      w = wRect.width;
      h = wRect.width / aspect;
    } else {
      h = wRect.height;
      w = wRect.height * aspect;
    }

    setDisplayed(prev => {
      // Si ya teníamos un display y queremos preservar la box, reescalar
      if (prev && preservarBox && prev.w > 0 && prev.h > 0) {
        const rx = box.x / prev.w, ry = box.y / prev.h;
        const rw = box.w / prev.w, rh = box.h / prev.h;
        setBox({ x: w * rx, y: h * ry, w: w * rw, h: h * rh });
      } else {
        // Box inicial: 85% ancho, 28% alto, centrado (proporciones tipo PDF417)
        const bw = w * 0.85;
        const bh = h * 0.28;
        setBox({ x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh });
      }
      return { w, h };
    });
  };

  const onImgLoad = () => recalcular(false);

  useEffect(() => {
    const onResize = () => recalcular(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, displayed]);

  // Inicia drag — usa listeners a nivel `document` para no perder eventos al
  // arrastrar fuera del recuadro (los pointer-events sobre el wrapper se
  // perdían cuando el dedo salía del área).
  const startDrag = (e: React.PointerEvent, mode: DragMode) => {
    if (disabled || !displayed) return;
    e.preventDefault();
    e.stopPropagation();
    dragInfo.current = { mode, px: e.clientX, py: e.clientY, box: { ...box } };

    const onMove = (ev: PointerEvent) => {
      if (!dragInfo.current || !displayed) return;
      ev.preventDefault();
      const { mode, px, py, box: s } = dragInfo.current;
      const dx = ev.clientX - px;
      const dy = ev.clientY - py;
      const maxW = displayed.w;
      const maxH = displayed.h;
      const MIN = 40;

      let x = s.x, y = s.y, w = s.w, h = s.h;
      if (mode === 'move') {
        x = clamp(s.x + dx, 0, maxW - s.w);
        y = clamp(s.y + dy, 0, maxH - s.h);
      } else {
        let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
        if (mode === 'tl' || mode === 'bl') left   = clamp(s.x + dx, 0, right - MIN);
        if (mode === 'tr' || mode === 'br') right  = clamp(s.x + s.w + dx, left + MIN, maxW);
        if (mode === 'tl' || mode === 'tr') top    = clamp(s.y + dy, 0, bottom - MIN);
        if (mode === 'bl' || mode === 'br') bottom = clamp(s.y + s.h + dy, top + MIN, maxH);
        x = left; y = top; w = right - left; h = bottom - top;
      }
      setBox({ x, y, w, h });
    };
    const onUp = () => {
      dragInfo.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const decodificar = () => {
    const img = imgRef.current;
    if (!img || !displayed) return;
    const scaleX = img.naturalWidth / displayed.w;
    const scaleY = img.naturalHeight / displayed.h;
    const sx = box.x * scaleX;
    const sy = box.y * scaleY;
    const sw = box.w * scaleX;
    const sh = box.h * scaleY;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onDecode(canvas);
  };

  const onRetakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onRetakeFile(f);
    e.target.value = '';
  };

  return (
    <>
      <div
        ref={wrapperRef}
        className="flex-1 relative bg-black flex items-center justify-center min-h-0 overflow-hidden"
      >
        {/* Mensajes de estado superpuestos */}
        {decodingState === 'decodificando' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium z-20">
            Decodificando…
          </div>
        )}
        {decodingState === 'sin_codigo' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/95 text-white px-3 py-1.5 rounded-lg text-xs font-medium max-w-[92%] text-center z-20">
            {errorMsg}
          </div>
        )}

        {/* Contenedor del tamaño EXACTO de la imagen mostrada */}
        <div
          className="relative touch-none select-none"
          style={displayed ? { width: displayed.w, height: displayed.h } : { width: 1, height: 1, opacity: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imgUrl}
            alt="Foto del DNI"
            onLoad={onImgLoad}
            draggable={false}
            className="block w-full h-full pointer-events-none"
          />

          {displayed && (
            <div
              className="absolute border-2 border-emerald-400 cursor-move"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, 'move')}
            >
              <div className="absolute inset-0 ring-1 ring-emerald-300/50 pointer-events-none" />
              <CornerHandle pos="tl" onDown={(e) => startDrag(e, 'tl')} />
              <CornerHandle pos="tr" onDown={(e) => startDrag(e, 'tr')} />
              <CornerHandle pos="bl" onDown={(e) => startDrag(e, 'bl')} />
              <CornerHandle pos="br" onDown={(e) => startDrag(e, 'br')} />
            </div>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 flex flex-col landscape:flex-row gap-2.5 shrink-0">
        <label className={`w-full landscape:flex-1 py-3 rounded-lg bg-white text-slate-900 font-semibold text-sm text-center cursor-pointer active:bg-slate-100 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
          ↺ Volver a tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onRetakeChange}
          />
        </label>
        <button
          onClick={decodificar}
          disabled={disabled || !displayed}
          className="w-full landscape:flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50"
        >
          ✂️ Decodificar área seleccionada
        </button>
      </div>
    </>
  );
}

function CornerHandle({ pos, onDown }: { pos: Corner; onDown: (e: React.PointerEvent) => void }) {
  const positions: Record<Corner, string> = {
    tl: '-top-3.5 -left-3.5 cursor-nwse-resize',
    tr: '-top-3.5 -right-3.5 cursor-nesw-resize',
    bl: '-bottom-3.5 -left-3.5 cursor-nesw-resize',
    br: '-bottom-3.5 -right-3.5 cursor-nwse-resize',
  };
  return (
    <div
      className={`absolute w-7 h-7 bg-emerald-400 rounded-full border-2 border-white shadow-lg ${positions[pos]}`}
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
    />
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
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