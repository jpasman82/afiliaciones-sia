// ============================================================================
//  app/components/ui/Stepper.tsx — Circuito de control (Cargada → Aprobada)
// ============================================================================
import React from 'react';
import { CIRCUITO, CIRCUITO_LABEL, ESTADOS } from '../../lib/estados';
import { Icon } from './Icon';

export function Stepper({ estado }: { estado: string }) {
  const fueraDeFlujo = ['error', 'suspendido', 'baja'].includes(estado);
  const actualStep = ESTADOS[estado]?.step ?? 1;
  return (
    <div className="flex items-center w-full">
      {CIRCUITO.map((k, i) => {
        const stepN = i + 1;
        const done = !fueraDeFlujo && stepN < actualStep;
        const current = !fueraDeFlujo && stepN === actualStep;
        const errorHere = estado === 'error' && k === 'cargado_je';
        return (
          <React.Fragment key={k}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 transition
                ${errorHere ? 'bg-rose-500 text-white ring-rose-500'
                  : done ? 'bg-emerald-500 text-white ring-emerald-500'
                  : current ? 'bg-brand-700 text-white ring-brand-700'
                  : 'bg-white text-slate-400 ring-slate-200'}`}>
                {done ? <Icon name="check" className="w-4 h-4" strokeWidth={3} /> : errorHere ? '!' : stepN}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide ${current || done ? 'text-slate-700' : 'text-slate-400'}`}>
                {CIRCUITO_LABEL[k]}
              </span>
            </div>
            {i < CIRCUITO.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 rounded ${!fueraDeFlujo && stepN < actualStep ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
