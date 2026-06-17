// ============================================================================
// app/components/ficha/EscanerCodigoBarras.tsx
//
// Flujo simple y confiable:
// 1) Abrir cámara nativa del teléfono o elegir imagen.
// 2) El usuario saca una foto real.
// 3) Se lee directamente ese archivo de imagen.
// 4) No hay preview de cámara.
// 5) No hay lectura desde video.
// ============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';
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

type Estado = 'inicial' | 'leyendo' | 'parseado' | 'error';

export function EscanerCodigoBarras({ onClose, onApply }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fotoUrlRef = useRef('');

  const [estado, setEstado] = useState<Estado>('inicial');
  const [fotoUrl, setFotoUrl] = useState('');
  const [parsed, setParsed] = useState<ParsedDni | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      if (fotoUrlRef.current) {
        URL.revokeObjectURL(fotoUrlRef.current);
      }
    };
  }, []);

  const abrirCamara = () => {
    fileInputRef.current?.click();
  };

  const limpiarFotoAnterior = () => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
      fotoUrlRef.current = '';
    }

    setFotoUrl('');
  };

  const recibirFoto = async (file: File | undefined) => {
    if (!file) return;

    limpiarFotoAnterior();

    const url = URL.createObjectURL(file);
    fotoUrlRef.current = url;

    setFotoUrl(url);
    setParsed(null);
    setErrorMsg('');
    setEstado('leyendo');

    try {
      // PRIMER INTENTO:
      // Leer directamente la foto original que devuelve la cámara nativa.
      const raw = await decodificarImagenDesdeUrl(url);
      const p = parseDniPdf417(raw);

      setParsed(p);
      setEstado('parseado');
    } catch (e) {
      console.error('[DNI PDF417] No se pudo leer la foto original', e);

      if (esNotFoundException(e)) {
        setErrorMsg(
          'No se pudo leer el código en la foto. Probá sacar otra foto más cerca, bien enfocada y con buena luz.',
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
    if (estado === 'leyendo') return 'Leyendo la foto tomada';
    if (estado === 'parseado') return 'Revisá los datos detectados';
    if (estado === 'error') return 'No se pudo leer la foto';
    return 'Sacá una foto del código PDF417 del DNI';
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
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void recibirFoto(file);
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
            Se va a abrir la cámara nativa del teléfono. Sacá una foto del código de barras PDF417
            del dorso del DNI. Después se va a leer esa imagen.
          </p>

          <button
            type="button"
            onClick={abrirCamara}
            className="w-full max-w-sm py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700"
          >
            Sacar foto y leer
          </button>

          <button
            type="button"
            onClick={abrirCamara}
            className="w-full max-w-sm mt-3 py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15"
          >
            Elegir foto existente
          </button>
        </div>
      )}

      {estado === 'leyendo' && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-black text-white">
          {fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt="Foto tomada del código"
              className="max-w-full max-h-[65vh] object-contain rounded-lg mb-5"
            />
          )}

          <div className="flex items-center gap-3 text-sm text-white/80">
            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Leyendo el código desde la foto…
          </div>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex-1 flex flex-col bg-black text-white">
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoUrl}
                alt="Foto que no pudo leerse"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <p className="text-white/70 text-sm">No hay foto cargada.</p>
            )}
          </div>

          <div className="p-4 bg-black border-t border-white/10">
            <div className="mb-3 p-3 rounded-lg bg-amber-500/15 ring-1 ring-amber-400/30">
              <p className="text-sm text-amber-100">{errorMsg}</p>
            </div>

            <button
              type="button"
              onClick={abrirCamara}
              className="w-full py-3.5 rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-lg active:bg-emerald-700"
            >
              Sacar otra foto
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 py-3 rounded-lg bg-white/10 text-white font-semibold text-xs ring-1 ring-white/20 active:bg-white/15"
            >
              Cancelar
            </button>
          </div>
        </div>
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
              onClick={abrirCamara}
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

async function decodificarImagenDesdeUrl(url: string): Promise<string> {
  const reader = new BrowserPDF417Reader();

  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  (reader as BrowserPDF417Reader & {
    hints?: Map<DecodeHintType, unknown>;
  }).hints = hints;

  const result = await reader.decodeFromImageUrl(url);

  return result.getText();
}

function esNotFoundException(e: unknown) {
  return e instanceof NotFoundException || (e as { name?: string })?.name === 'NotFoundException';
}