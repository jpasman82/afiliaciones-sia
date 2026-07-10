// ============================================================================
//  app/lib/estados.ts — Tokens de dominio: estados de control, circuito, roles
//  Centraliza lo que hoy está embebido en page.tsx (estadoControlCfg, roles).
// ============================================================================
import type { EstadoControl, Rol } from './types';

export const ESTADOS: Record<string, { label: string; cls: string; dot: string; step: number }> = {
  pendiente:  { label: 'Pendiente',    cls: 'bg-slate-100 text-slate-600 ring-slate-200',     dot: 'bg-slate-400',   step: 1 },
  escaneado:  { label: 'Escaneada',    cls: 'bg-violet-50 text-violet-700 ring-violet-200',   dot: 'bg-violet-500',  step: 2 },
  cargado_je: { label: 'En JE',        cls: 'bg-amber-50 text-amber-700 ring-amber-200',       dot: 'bg-amber-500',   step: 3 },
  aprobado:   { label: 'Aprobada',     cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500', step: 4 },
  error:      { label: 'Con error',    cls: 'bg-rose-50 text-rose-700 ring-rose-200',          dot: 'bg-rose-500',    step: 3 },
  suspendido: { label: 'Suspendido',   cls: 'bg-orange-50 text-orange-700 ring-orange-200',    dot: 'bg-orange-500',  step: 0 },
  baja:       { label: 'Dado de baja', cls: 'bg-slate-200 text-slate-600 ring-slate-300',      dot: 'bg-slate-500',   step: 0 },
  // 'firmado' existe en el modelo pero el flujo real va de pendiente → escaneado.
  firmado:    { label: 'Firmada',      cls: 'bg-sky-50 text-sky-700 ring-sky-200',             dot: 'bg-sky-500',     step: 2 },
  // Validación digital vía RENAPER/Didit — flujo aditivo, no modifica el circuito manual.
  // Nombre legacy: la validación la hace Didit, no RENAPER. No renombrar: es un valor persistido en Firestore.
  validado_renaper: { label: 'Validado RENAPER', cls: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500', step: 2 },
};

/** Circuito principal para el Stepper. Estados fuera de flujo: error/suspendido/baja. */
export const CIRCUITO: EstadoControl[] = ['pendiente', 'escaneado', 'cargado_je', 'aprobado'];
export const CIRCUITO_LABEL: Record<string, string> = {
  pendiente: 'Cargada', escaneado: 'Escaneada', cargado_je: 'En JE', aprobado: 'Aprobada',
};

export const ROLES: Record<Rol, { label: string; cls: string }> = {
  pendiente:  { label: 'Pendiente',  cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  afiliador:  { label: 'Afiliador',  cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  supervisor: { label: 'Supervisor', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  admin:      { label: 'Admin',      cls: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

export const LOCALIDADES = ['Acassuso', 'Beccar', 'Boulogne', 'Martínez', 'San Isidro', 'Villa Adelina'];
