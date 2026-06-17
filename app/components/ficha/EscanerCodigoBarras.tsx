// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Modal manual de escaneo. Recibe las dataUrl del frente y/o dorso ya
//  tomadas. Si hay ambas, el usuario elige una. Después muestra la foto con
//  un recuadro arrastrable + redimensionable encima del PDF417, y al
//  "Decodificar" extrae esa región y la pasa a ZXing.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { decodeDniBarcode } from '../../lib/decodeDniBarcode';
import { parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  fotoFrente: string | null;
  fotoDorso: string | null;
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

type Estado = 'choosing' | 'recortando' | 'decodificando' | 'parseado' | 'sin_codigo';

export function EscanerCodigoBarras({ fotoFrente, fotoDorso, onClose, onApply }: Props) {
  const ambas = !!(fotoFrente && fotoDorso);
  const fotoUnica = !ambas ? (fotoDorso || fotoFrente) : null;

  const [estado, setEstado] = useState<Estado>(ambas ? 'choosing' : 'recortando');
  const [fotoElegida, setFotoElegida] = useState<string | null>(fotoUnica);
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const elegir = (foto: string) => {
    setFotoElegida(foto);
    setEstado('recortando');
    setErrorMsg('');
  };

  const decodificarCanvas = async (canvas: HTMLCanvasElement) => {
    setEstado('decodificando');
    const dataUrl = canvas.toDataURL('image/png');
    const p = await decodeDniBarcode(dataUrl);
    if (p && (p.dni || p.apellidos)) {
      setParsed(p);
      setEstado('parseado');
    } else {
      setErrorMsg('No se detectó el código en el área seleccionada. Ajustá el recuadro al PDF417 y reintentá.');
      setEstado('sin_codigo');
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
      case 'choosing':      return '¿Qué foto querés escanear?';
      case 'recortando':    return 'Ajustá el recuadro sobre el código de barras';
      case 'decodificando': return 'Decodificando…';
      case 'parseado':      return 'Revisá los datos detectados';
      case 'sin_codigo':    return 'No se detectó el código';
    }
  })();

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-3 md:p-4 bg-black text-white flex justify-between items-center shrink-0">
        <div className="min-w-0">
          <h3 className="font-bold text-base">Escanear código de barras</h3>
          <p className="text-[11px] text-white/60 mt-0.5 truncate">{subtitulo}</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm shrink-0 ml-3">Cerrar</button>
      </div>

      {estado === 'choosing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black gap-4">
          <p className="text-white/70 text-sm text-center mb-2">El código PDF417 está en el dorso del DNI.</p>
          <div className="grid grid-cols-2 gap-3 max-w-md w-full">
            {fotoFrente && <PhotoOption label="Frente" foto={fotoFrente} onClick={() => elegir(fotoFrente)} />}
            {fotoDorso && <PhotoOption label="Dorso" foto={fotoDorso} onClick={() => elegir(fotoDorso)} />}
          </div>
        </div>
      )}

      {(estado === 'recortando' || estado === 'decodificando' || estado === 'sin_codigo') && fotoElegida && (
        <Cropper
          imgUrl={fotoElegida}
          disabled={estado === 'decodificando'}
          decodingState={estado}
          errorMsg={errorMsg}
          puedeCambiarFoto={ambas}
          onDecode={decodificarCanvas}
          onCambiarFoto={() => { setEstado('choosing'); setErrorMsg(''); }}
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
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Ver texto crudo</summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">{parsed.raw}</pre>
              </details>
            </div>
          </div>
          <div className="p-3 md:p-4 bg-white border-t border-slate-200 flex gap-3 max-w-2xl mx-auto w-full shrink-0">
            <button onClick={volverARecorte} className="flex-1 py-3 rounded-lg bg-white text-slate-700 ring-1 ring-slate-300 font-semibold text-sm hover:bg-slate-50 transition">
              Ajustar recorte
            </button>
            <button onClick={aplicar} disabled={!parsed.apellidos && !parsed.nombres && !parsed.dni}
              className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Aplicar al formulario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoOption({ label, foto, onClick }: { label: string; foto: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-900 ring-2 ring-slate-700 hover:ring-emerald-500 active:ring-emerald-500 transition">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto} alt={label} className="w-full h-32 object-contain rounded" />
      <span className="text-white font-bold text-sm">{label}</span>
    </button>
  );
}

// ============================================================================
//  Cropper: imagen + recuadro arrastrable + redimensionable
//  Mide el tamaño real de la imagen mostrada (object-contain manual) y
//  posiciona el recuadro dentro de ese div, no del wrapper externo. Eso
//  permite mover el recuadro por toda la foto, no solo por un sector.
// ============================================================================

type Box = { x: number; y: number; w: number; h: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type DragMode = 'move' | Corner;

function Cropper({
  imgUrl, disabled, decodingState, errorMsg, puedeCambiarFoto, onDecode, onCambiarFoto,
}: {
  imgUrl: string;
  disabled: boolean;
  decodingState: Estado;
  errorMsg: string;
  puedeCambiarFoto: boolean;
  onDecode: (canvas: HTMLCanvasElement) => void;
  onCambiarFoto: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displayed, setDisplayed] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const dragInfo = useRef<{ mode: DragMode; px: number; py: number; box: Box } | null>(null);

  const recalcular = (preservarBox = false) => {
    const img = imgRef.current;
    const wrap = wrapperRef.current;
    if (!img || !wrap || !img.naturalWidth) return;
    const wRect = wrap.getBoundingClientRect();
    const aspect = img.naturalWidth / img.naturalHeight;
    let w: number, h: number;
    if (wRect.width / aspect <= wRect.height) {
      w = wRect.width;  h = wRect.width / aspect;
    } else {
      h = wRect.height; w = wRect.height * aspect;
    }
    setDisplayed(prev => {
      if (prev && preservarBox && prev.w > 0 && prev.h > 0) {
        const rx = box.x / prev.w, ry = box.y / prev.h;
        const rw = box.w / prev.w, rh = box.h / prev.h;
        setBox({ x: w * rx, y: h * ry, w: w * rw, h: h * rh });
      } else {
        const bw = w * 0.85, bh = h * 0.20;
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
  }, []);

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
      const maxW = displayed.w, maxH = displayed.h, MIN = 40;
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
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(box.w * scaleX);
    canvas.height = Math.round(box.h * scaleY);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY,
                       0, 0, canvas.width, canvas.height);
    onDecode(canvas);
  };

  return (
    <>
      <div ref={wrapperRef} className="flex-1 relative bg-black flex items-center justify-center min-h-0 overflow-hidden">
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

        <div className="relative touch-none select-none" style={displayed ? { width: displayed.w, height: displayed.h } : { width: 1, height: 1, opacity: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={imgUrl} alt="Foto del DNI" onLoad={onImgLoad} draggable={false}
            className="block w-full h-full pointer-events-none" />
          {displayed && (
            <div className="absolute border-2 border-emerald-400 cursor-move"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, 'move')}>
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
        {puedeCambiarFoto && (
          <button onClick={onCambiarFoto} disabled={disabled}
            className="w-full landscape:flex-1 py-3 rounded-lg bg-white text-slate-900 font-semibold text-sm active:bg-slate-100 disabled:opacity-50">
            ↔ Cambiar foto
          </button>
        )}
        <button onClick={decodificar} disabled={disabled || !displayed}
          className="w-full landscape:flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700 disabled:opacity-50">
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
  return <div className={`absolute w-7 h-7 bg-emerald-400 rounded-full border-2 border-white shadow-lg ${positions[pos]}`}
    style={{ touchAction: 'none' }} onPointerDown={onDown} />;
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