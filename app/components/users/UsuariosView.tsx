// ============================================================================
//  app/components/users/UsuariosView.tsx — Gestión de usuarios y roles
//  Callbacks que conectás a tus updateDoc:
//   - actualizarRol(uid, rol)
//   - guardarNombre(uid, { nombre, apellido })
// ============================================================================
import { useState } from 'react';
import type { Rol, Usuario } from '../../lib/types';
import { ROLES } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Input } from '../ui/Form';
import { RoleBadge } from '../ui/Badges';
import { Avatar, Card, PageHeader } from '../ui/Primitives';

interface Props {
  role: Rol;
  usuarios: Usuario[];
  actualizarRol: (uid: string, rol: Rol) => void;
  guardarNombre: (uid: string, datos: { nombre: string; apellido: string }) => void | Promise<void>;
}

export function UsuariosView({ role, usuarios, actualizarRol, guardarNombre }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '' });
  const esAdmin = role === 'admin';
  const opcionesRol: Rol[] = esAdmin ? ['pendiente', 'afiliador', 'supervisor', 'admin'] : ['pendiente', 'afiliador'];
  const puedeEditar = (u: Usuario) => esAdmin || (u.rol !== 'admin' && u.rol !== 'supervisor');
  const pendientes = usuarios.filter(u => u.rol === 'pendiente');

  const startEdit = (u: Usuario) => { setEditId(u.id); setForm({ nombre: u.nombre, apellido: u.apellido }); };
  const saveEdit = async (u: Usuario) => {
    try {
      await guardarNombre(u.id, { nombre: form.nombre.trim(), apellido: form.apellido.trim() });
      setEditId(null);
    } catch (error) {
      // No cerrar la edición: que el usuario pueda reintentar.
      console.error('[usuarios] Error al guardar nombre:', error);
      alert('No se pudo guardar el nombre. Intentá de nuevo.');
    }
  };

  return (
    <div data-screen-label="Usuarios">
      <PageHeader title="Usuarios" sub="Gestión de accesos y roles" />

      {pendientes.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 ring-1 ring-inset ring-amber-200 px-4 py-3 mb-5 text-sm text-amber-800">
          <Icon name="alert" className="w-5 h-5 shrink-0" strokeWidth={2} />
          <span><span className="font-semibold">{pendientes.length} usuario{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}</span> de aprobación.</span>
        </div>
      )}

      {/* DESKTOP */}
      <Card className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition">
                <td className="px-4 py-3">
                  {editId === u.id ? (
                    <div className="flex gap-2">
                      <Input className="py-1.5 text-sm" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre" />
                      <Input className="py-1.5 text-sm" value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} placeholder="Apellido" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Avatar nombre={u.nombre} apellido={u.apellido} size="sm" />
                      <span className="font-semibold text-slate-800">{u.nombre || u.apellido ? `${u.apellido}, ${u.nombre}` : <span className="text-slate-400 italic font-normal">Sin completar</span>}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">
                  {puedeEditar(u) ? (
                    <select value={u.rol} onChange={e => actualizarRol(u.id, e.target.value as Rol)}
                      className="rounded-lg ring-1 ring-inset ring-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer focus:ring-2 focus:ring-brand-500 outline-none">
                      {opcionesRol.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
                    </select>
                  ) : <RoleBadge rol={u.rol} />}
                </td>
                <td className="px-4 py-3 text-right">
                  {editId === u.id ? (
                    <div className="flex gap-1.5 justify-end"><Button size="sm" onClick={() => saveEdit(u)}>Guardar</Button><Button size="sm" variant="ghost" onClick={() => setEditId(null)}>×</Button></div>
                  ) : puedeEditar(u) && (
                    <button onClick={() => startEdit(u)} className="text-slate-400 hover:text-brand-700 p-1.5 rounded-md hover:bg-slate-100 transition"><Icon name="edit" className="w-4 h-4" strokeWidth={2} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* MOBILE */}
      <div className="md:hidden space-y-2.5">
        {usuarios.map(u => (
          <Card key={u.id} className="p-3.5">
            <div className="flex items-center gap-3">
              <Avatar nombre={u.nombre} apellido={u.apellido} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">{u.nombre || u.apellido ? `${u.apellido}, ${u.nombre}` : <span className="text-slate-400 italic font-normal">Sin completar</span>}</div>
                <div className="text-xs text-slate-400 truncate">{u.email}</div>
              </div>
              <RoleBadge rol={u.rol} />
            </div>
            {puedeEditar(u) && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Rol:</span>
                <select value={u.rol} onChange={e => actualizarRol(u.id, e.target.value as Rol)}
                  className="flex-1 rounded-lg ring-1 ring-inset ring-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                  {opcionesRol.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
