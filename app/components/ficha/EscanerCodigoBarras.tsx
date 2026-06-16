// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Lector PDF417 del DNI por foto + recorte.
//  Flujo: el usuario toma una foto con la cámara nativa, ajusta un recuadro
//  para encerrar solo el código de barras, y decodificamos esa región.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserPDF417Reader, DecodeHintType, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'esperando_foto' | 'recortando' | 'decodificando' | 'parseado' | 'sin_codigo';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const [estado, setEstado] = useState<Estado>('esperando_foto');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Liberar el blob URL cuando se cierra o cambia
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  const onFotoTomada = (file: File) => {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    const url = URL.createObjectURL(file);
    setImgUrl(url);
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

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-3 md:p-4 bg-black text-white flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-base">Escanear DNI</h3>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">
            {estado === 'esperando_foto' && 'Tomá una foto del dorso del DNI'}
            {estado === 'recortando' && 'Ajustá el recuadro al código de barras'}
            {estado === 'decodificando' && 'Decodificando…'}
            {estado === 'parseado' && 'Revisá los datos detectados'}
            {estado === 'sin_codigo' && 'No se detectó código en el área recortada'}
          </p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3">Cerrar</button>
      </div>

      {/* PASO 1: Esperar que el usuario tome la foto */}
      {estado === 'esperando_foto' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center mb-5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
            </svg>
          </div>
          <p className="text-center mb-1 max-w-sm text-base font-semibold">Tomar foto del dorso del DNI</p>
          <p className="text-center text-white/60 text-sm max-w-sm mb-6">
            Acercate al PDF417 (el rectángulo de barras verticales) hasta que se vea nítido. Después podrás recortar para enmarcar solo el código.
          </p>
          <label className="block w-full max-w-sm py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg text-center cursor-pointer active:bg-emerald-700">
            📷 Abrir cámara
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFotoTomada(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {/* PASO 2: Recortar */}
      {(estado === 'recortando' || estado === 'decodificando' || estado === 'sin_codigo') && imgUrl && (
        <Cropper
          imgUrl={imgUrl}
          disabled={estado === 'decodificando'}
          decodingState={estado}
          errorMsg={errorMsg}
          onDecode={decodificarCanvas}
          onRetake={() => setEstado('esperando_foto')}
        />
      )}

      {/* PASO 3: Resultado */}
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

// ============================================================================
//  Cropper: muestra una imagen y un recuadro arrastrable + redimensionable
// ============================================================================

type Box = { x: number; y: number; w: number; h: number }; // en píxeles del display
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type DragMode = 'move' | Corner;

function Cropper({
  imgUrl, disabled, decodingState, errorMsg, onDecode, onRetake,
}: {
  imgUrl: string;
  disabled: boolean;
  decodingState: Estado;
  errorMsg: string;
  onDecode: (canvas: HTMLCanvasElement) => void;
  onRetake: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const dragStart = useRef<{ px: number; py: number; box: Box } | null>(null);

  // Tamaño actual de la imagen renderizada (puede cambiar si la ventana redimensiona)
  const calcularBoxInicial = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (w === 0 || h === 0) return;
    // Recuadro inicial: ~85% del ancho, ~28% del alto, centrado (proporciones típicas del PDF417)
    const bw = w * 0.85;
    const bh = h * 0.28;
    setBox({ x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh });
  };

  const onImgLoad = () => {
    setImgLoaded(true);
    calcularBoxInicial();
  };

  useEffect(() => {
    const onResize = () => calcularBoxInicial();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, mode: DragMode) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragMode(mode);
    dragStart.current = { px: e.clientX, py: e.clientY, box: { ...box } };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragMode || !dragStart.current) return;
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const maxW = img.clientWidth;
    const maxH = img.clientHeight;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    const s = dragStart.current.box;
    const MIN = 40;

    let { x, y, w, h } = s;
    if (dragMode === 'move') {
      x = clamp(s.x + dx, 0, maxW - s.w);
      y = clamp(s.y + dy, 0, maxH - s.h);
    } else {
      // Para resize, calculamos los bordes y reconstruimos la box
      let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
      if (dragMode === 'tl' || dragMode === 'bl') left = clamp(s.x + dx, 0, right - MIN);
      if (dragMode === 'tr' || dragMode === 'br') right = clamp(s.x + s.w + dx, left + MIN, maxW);
      if (dragMode === 'tl' || dragMode === 'tr') top = clamp(s.y + dy, 0, bottom - MIN);
      if (dragMode === 'bl' || dragMode === 'br') bottom = clamp(s.y + s.h + dy, top + MIN, maxH);
      x = left; y = top; w = right - left; h = bottom - top;
    }
    setBox({ x, y, w, h });
  };

  const endDrag = () => {
    setDragMode(null);
    dragStart.current = null;
  };

  const decodificar = () => {
    const img = imgRef.current;
    if (!img) return;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
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

  return (
    <>
      <div
        ref={wrapperRef}
        className="flex-1 relative bg-black overflow-hidden flex items-center justify-center min-h-0 touch-none select-none"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imgUrl}
          alt="Foto del DNI"
          onLoad={onImgLoad}
          className="max-w-full max-h-full object-contain pointer-events-none"
          draggable={false}
        />

        {imgLoaded && (
          <>
            {/* Mensaje de estado overlay */}
            {decodingState === 'decodificando' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium z-10">
                Decodificando…
              </div>
            )}
            {decodingState === 'sin_codigo' && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium max-w-[90%] text-center z-10">
                {errorMsg || 'No se detectó código en el área recortada. Ajustá el recuadro y reintentá.'}
              </div>
            )}

            {/* Recuadro */}
            <div
              className="absolute border-2 border-emerald-400 cursor-move"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, 'move')}
            >
              {/* Sombreado interior leve */}
              <div className="absolute inset-0 ring-1 ring-emerald-300/50 pointer-events-none" />
              {/* Esquinas */}
              <CornerHandle pos="tl" onDown={(e) => startDrag(e, 'tl')} />
              <CornerHandle pos="tr" onDown={(e) => startDrag(e, 'tr')} />
              <CornerHandle pos="bl" onDown={(e) => startDrag(e, 'bl')} />
              <CornerHandle pos="br" onDown={(e) => startDrag(e, 'br')} />
            </div>
          </>
        )}
      </div>

      {/* Acciones: stacked en portrait, en fila en landscape para no comer espacio vertical */}
      <div className="bg-black p-3 md:p-4 flex flex-col landscape:flex-row gap-2.5 shrink-0">
        <button
          onClick={onRetake}
          disabled={disabled}
          className="w-full landscape:flex-1 py-3 rounded-lg bg-white text-slate-900 font-semibold text-sm active:bg-slate-100 disabled:opacity-50"
        >
          ↺ Volver a tomar foto
        </button>
        <button
          onClick={decodificar}
          disabled={disabled}
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
    tl: '-top-3 -left-3 cursor-nwse-resize',
    tr: '-top-3 -right-3 cursor-nesw-resize',
    bl: '-bottom-3 -left-3 cursor-nesw-resize',
    br: '-bottom-3 -right-3 cursor-nwse-resize',
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