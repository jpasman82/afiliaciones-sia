// ============================================================================
//  app/components/ficha/EscanerCodigoBarras.tsx
//  Lector PDF417 del DNI usando ZXing. Funciona dentro del navegador, sin
//  servicios externos. Después de leer, muestra un panel con los datos
//  parseados para que el usuario los revise antes de aplicarlos al formulario.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library';
import { parseDniPdf417, parsedDniToFormFields, type ParsedDni } from '../../lib/parseDniPdf417';

type Props = {
  onClose: () => void;
  onApply: (campos: ReturnType<typeof parsedDniToFormFields>, parsed: ParsedDni) => void;
};

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [estado, setEstado] = useState<'iniciando' | 'escaneando' | 'parseado' | 'error'>('iniciando');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    let cancelado = false;

    (async () => {
      try {
        // undefined = usa la cámara por default (rear en móvil si está disponible)
        await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
          videoRef.current!,
          (result, err) => {
            if (cancelado) return;
            if (result) {
              const raw = result.getText();
              const p = parseDniPdf417(raw);
              setParsed(p);
              setEstado('parseado');
              // Cuando ya leyó, detenemos el stream para liberar la cámara
              reader.reset();
            }
            // err es esperable cuando todavía no encuentra código (NotFoundException),
            // sólo logueamos errores reales
            if (err && !(err instanceof NotFoundException)) {
              console.debug('[ZXing]', err);
            }
          }
        );
        if (!cancelado) setEstado('escaneando');
      } catch (e: any) {
        if (cancelado) return;
        setErrorMsg(e?.message || 'No se pudo acceder a la cámara.');
        setEstado('error');
      }
    })();

    return () => {
      cancelado = true;
      try { reader.reset(); } catch {}
    };
  }, []);

  const reiniciar = () => {
    setParsed(null);
    setEstado('iniciando');
    setErrorMsg('');
    // Re-mount: forzamos un nuevo decode reiniciando el reader
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);
    readerRef.current = reader;

    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      videoRef.current!,
      (result, err) => {
        if (result) {
          const raw = result.getText();
          const p = parseDniPdf417(raw);
          setParsed(p);
          setEstado('parseado');
          reader.reset();
        }
        if (err && !(err instanceof NotFoundException)) {
          console.debug('[ZXing]', err);
        }
      }
    ).then(() => setEstado('escaneando')).catch((e: any) => {
      setErrorMsg(e?.message || 'No se pudo acceder a la cámara.');
      setEstado('error');
    });
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
          <h3 className="font-bold text-lg">Escanear código del DNI</h3>
          <p className="text-xs text-white/60 mt-0.5">Apuntá al código de barras del dorso (PDF417)</p>
        </div>
        <button onClick={onClose} className="text-white font-bold px-3 py-1.5 bg-red-600 rounded text-sm">Cerrar</button>
      </div>

      {/* Video + overlay (visible mientras escanea) */}
      <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${estado === 'parseado' ? 'hidden' : ''}`}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        {/* Marco más ancho que alto: el PDF417 del DNI es horizontal */}
        <div className="relative w-[90%] aspect-[3/1] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
        </div>
        <div className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm font-medium px-4">
          {estado === 'iniciando' && 'Iniciando cámara…'}
          {estado === 'escaneando' && 'Mantené el código dentro del recuadro'}
          {estado === 'error' && <span className="text-rose-300">{errorMsg}</span>}
        </div>
      </div>

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