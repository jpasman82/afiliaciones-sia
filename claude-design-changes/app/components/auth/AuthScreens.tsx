// ============================================================================
//  app/components/auth/AuthScreens.tsx — Login y Perfil pendiente
// ============================================================================
import { useState } from 'react';
import Image from 'next/image';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';
import { Card } from '../ui/Primitives';

export function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6" data-screen-label="Login">
      <div className="w-full max-w-sm text-center">
        <Image src="/logo.png" alt="SIA" width={96} height={96} className="w-24 h-24 object-contain mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Afiliaciones <span className="text-brand-700">SIA</span></h1>
        <p className="text-sm text-slate-500 mt-2 mb-8">Sistema interno de gestión de afiliaciones</p>
        <button onClick={onLogin}
          className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-white ring-1 ring-slate-300 px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:ring-slate-400 transition shadow-sm">
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
          Ingresar con Gmail
        </button>
        <p className="text-xs text-slate-400 mt-6">El acceso debe ser aprobado por un administrador.</p>
      </div>
    </div>
  );
}

/** Pantalla de perfil pendiente: 'form' (completar nombre) o 'espera' (acceso pendiente). */
export function PerfilPendiente({ etapa, nombre, apellido, onSubmit, onLogout, guardando }:
  { etapa: 'form' | 'espera'; nombre?: string; apellido?: string;
    onSubmit: (datos: { nombre: string; apellido: string }) => void; onLogout: () => void; guardando?: boolean }) {
  const [form, setForm] = useState({ nombre: '', apellido: '' });

  if (etapa === 'espera') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6" data-screen-label="Acceso pendiente">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-5"><Icon name="shield" className="w-7 h-7" strokeWidth={1.8} /></div>
          <h1 className="text-xl font-bold text-slate-900">Acceso pendiente</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">Hola{nombre ? `, ${nombre} ${apellido || ''}` : ''}. Tu perfil está siendo validado por un administrador. Te avisaremos cuando puedas empezar a cargar fichas.</p>
          <button onClick={onLogout} className="mt-6 text-sm font-semibold text-brand-700 hover:text-brand-800">Cerrar sesión</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6" data-screen-label="Completar perfil">
      <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="w-full max-w-md">
        <Card className="p-8">
          <Image src="/logo.png" alt="SIA" width={48} height={48} className="w-12 h-12 object-contain mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Completá tu perfil</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">Ingresá tu nombre y apellido para solicitar acceso.</p>
          <div className="space-y-4">
            <Field label="Nombre" required><Input required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Tu nombre" /></Field>
            <Field label="Apellido" required><Input required value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} placeholder="Tu apellido" /></Field>
            <Button type="submit" disabled={guardando} className="w-full">{guardando ? 'Guardando…' : 'Solicitar acceso'}</Button>
          </div>
          <button type="button" onClick={onLogout} className="mt-5 text-xs font-medium text-slate-400 hover:text-slate-600 w-full text-center">Cancelar / Cerrar sesión</button>
        </Card>
      </form>
    </div>
  );
}
