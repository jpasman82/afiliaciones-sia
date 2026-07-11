// ============================================================================
//  app/components/records/RecordsView.tsx — Listado (tabla desktop / cards mobile)
//  Presentacional: recibe los registros ya filtrados por permiso desde page.tsx.
// ============================================================================
import { useState } from 'react';
import type { Ficha, Rol } from '../../lib/types';
import { ESTADOS } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select } from '../ui/Form';
import { StatusBadge, FileChip } from '../ui/Badges';
import { Avatar, Card, StatCard, PageHeader, EmptyState } from '../ui/Primitives';
import { Stepper } from '../ui/Stepper';

interface Props {
  role: Rol;
  registros: Ficha[];                 // ya acotados por permiso (afiliador = propios)
  afiliadores: { uid: string; nombre: string }[];
  search: string;
  onOpenDetalle: (id: string) => void;
  onExportCSV?: () => void;
  onDescargarZip?: () => void;
  descargandoZip?: boolean;
}

export function RecordsView({ role, registros, afiliadores, search, onOpenDetalle, onExportCSV, onDescargarZip, descargandoZip }: Props) {
  const isSup = role === 'admin' || role === 'supervisor';
  const [filtroAfil, setFiltroAfil] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todas');

  const lista = registros.filter(f => {
    if (isSup && filtroAfil !== 'todas' && f.afiliadorUid !== filtroAfil) return false;
    if (filtroEstado !== 'todas' && (f.estadoControl || 'pendiente') !== filtroEstado) return false;
    if (search.trim()) {
      const b = search.toLowerCase().trim();
      if (!(f.dni?.toLowerCase().includes(b) || f.nombres?.toLowerCase().includes(b) || f.apellidos?.toLowerCase().includes(b))) return false;
    }
    return true;
  });

  const total = registros.length;
  const aprob = registros.filter(f => f.estadoControl === 'aprobado').length;
  const pend = registros.filter(f => (f.estadoControl || 'pendiente') === 'pendiente').length;
  const enProc = registros.filter(f => ['escaneado', 'cargado_je'].includes(f.estadoControl || '')).length;

  return (
    <div data-screen-label="Registros">
      <PageHeader title="Registros" sub={isSup ? 'Todas las fichas de afiliación' : 'Tus fichas cargadas'}
        actions={<>
          {onExportCSV && <Button variant="secondary" icon="download" className="hidden sm:inline-flex" onClick={onExportCSV}>CSV</Button>}
          {onDescargarZip && <Button variant="secondary" icon="inbox" className="hidden sm:inline-flex" disabled={descargandoZip} onClick={onDescargarZip}>{descargandoZip ? 'Generando…' : 'ZIP'}</Button>}
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <StatCard label="Total" value={total} active={filtroEstado === 'todas'} onClick={() => setFiltroEstado('todas')} />
        <StatCard label="Pendientes" value={pend} accent="bg-slate-400" active={filtroEstado === 'pendiente'} onClick={() => setFiltroEstado('pendiente')} />
        <StatCard label="En proceso" value={enProc} accent="bg-amber-500" active={filtroEstado === 'cargado_je'} onClick={() => setFiltroEstado(filtroEstado === 'cargado_je' ? 'todas' : 'cargado_je')} />
        <StatCard label="Aprobadas" value={aprob} accent="bg-emerald-500" active={filtroEstado === 'aprobado'} onClick={() => setFiltroEstado('aprobado')} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        {isSup && (
          <Select value={filtroAfil} onChange={e => setFiltroAfil(e.target.value)} className="sm:w-56">
            <option value="todas">Todos los afiliadores</option>
            {afiliadores.map(u => <option key={u.uid} value={u.uid}>{u.nombre}</option>)}
          </Select>
        )}
        <Select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="sm:w-44">
          <option value="todas">Todos los estados</option>
          {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
        </Select>
      </div>

      {lista.length === 0 ? (
        <Card><EmptyState title="No se encontraron fichas" sub="Probá ajustando la búsqueda o los filtros." /></Card>
      ) : (
        <>
          {/* DESKTOP */}
          <Card className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3">Afiliado</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Localidad</th>
                  {isSup && <th className="px-4 py-3">Afiliador</th>}
                  <th className="px-4 py-3">Archivos</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 min-w-56">Progreso</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map(f => (
                  <tr key={f.id} onClick={() => onOpenDetalle(f.id)} className="group hover:bg-slate-50/70 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar nombre={f.nombres} apellido={f.apellidos} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{f.apellidos}, {f.nombres}</div>
                          <div className="text-xs text-slate-400">Clase {f.clase || '—'} · {f.sexo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="tnum font-medium text-slate-700">{f.dni}</span><span className="text-slate-300 ml-1.5 text-xs">{f.tipoDocumento || 'DNI'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{f.localidad}</td>
                    {isSup && <td className="px-4 py-3 text-slate-500 text-xs">{f.afiliadorNombre || f.afiliadorEmail}</td>}
                    <td className="px-4 py-3"><div className="flex gap-1.5"><FileChip ok={f.archivoDniPath || f.archivoDni} label="DNI" /><FileChip ok={f.archivoFichaPath || f.archivoFicha} label="Ficha" /></div></td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge estado={f.estadoControl || 'pendiente'} size="sm" />
                      {f.estadoControl === 'error' && f.errorJE && <p className="mt-1.5 max-w-40 text-xs text-rose-600">{f.errorJE}</p>}
                    </td>
                    <td className="px-4 py-3 min-w-56">
                      <EstadoProgreso ficha={f} />
                    </td>
                    <td className="px-4 py-3 text-slate-300 group-hover:text-brand-500 transition"><Icon name="chevronR" className="w-4 h-4" strokeWidth={2.5} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* MOBILE */}
          <div className="md:hidden space-y-2.5">
            {lista.map(f => (
              <button key={f.id} onClick={() => onOpenDetalle(f.id)}
                className="w-full text-left bg-white rounded-xl ring-1 ring-slate-200 shadow-card p-3.5 active:scale-[0.99] transition">
                <div className="flex items-start gap-3">
                  <Avatar nombre={f.nombres} apellido={f.apellidos} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-slate-800 truncate">{f.apellidos}, {f.nombres}</div>
                      <StatusBadge estado={f.estadoControl || 'pendiente'} size="sm" />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tnum">{f.tipoDocumento || 'DNI'} {f.dni} · {f.localidad}</div>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex gap-1.5"><FileChip ok={f.archivoDniPath || f.archivoDni} label="DNI" /><FileChip ok={f.archivoFichaPath || f.archivoFicha} label="Ficha" /></div>
                      {isSup && <span className="text-[11px] text-slate-400 truncate max-w-[40%]">{f.afiliadorNombre || f.afiliadorEmail}</span>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <EstadoProgreso ficha={f} />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-4 text-center">{lista.length} ficha{lista.length !== 1 ? 's' : ''}{lista.length !== total ? ` de ${total}` : ''}</p>
        </>
      )}
    </div>
  );
}

function EstadoProgreso({ ficha }: { ficha: Ficha }) {
  const estado = ficha.estadoControl || 'pendiente';

  if (estado === 'suspendido' || estado === 'baja') {
    return (
      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${estado === 'suspendido' ? 'bg-orange-50 text-orange-700 ring-orange-100' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
        <Icon name="alert" className="w-4 h-4 shrink-0" strokeWidth={2} />
        <span>{estado === 'suspendido' ? 'Afiliado suspendido' : 'Afiliado dado de baja'}{ficha.suspendidoComentario ? `: ${ficha.suspendidoComentario}` : ''}</span>
      </div>
    );
  }

  return (
    <div>
      <Stepper estado={estado} />
      {estado === 'error' && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-100">
          <Icon name="alert" className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span><span className="font-semibold">Error:</span> {ficha.errorJE || 'Sin detalle cargado.'}</span>
        </div>
      )}
    </div>
  );
}
