// ============================================================================
//  app/components/control/ControlView.tsx — Módulo de Control (solo admin)
//  Acciones vía callbacks que conectás a tus handlers de page.tsx:
//   - actualizarControl(id, estado, extras)  (tu updateDoc actual)
//   - onSubirFichaFisica(id)                 (abre cámara / archivo → escaneado)
// ============================================================================
import { useState } from 'react';
import type { Ficha } from '../../lib/types';
import { ESTADOS } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select, Field, Textarea, SearchInput } from '../ui/Form';
import { StatusBadge } from '../ui/Badges';
import { Avatar, Card, StatCard, PageHeader, EmptyState } from '../ui/Primitives';
import { Stepper } from '../ui/Stepper';

interface ControlProps {
  fichas: Ficha[];
  search: string;
  afiliadores: { uid: string; nombre: string }[];
  actualizarControl: (id: string, estado: string, extras?: Record<string, any>) => void;
  onSubirFichaFisica: (id: string) => void;
}

export function ControlView({ fichas, search, afiliadores, actualizarControl, onSubirFichaFisica }: ControlProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [filtroAfil, setFiltroAfil] = useState('todas');

  const ficha = sel ? fichas.find(f => f.id === sel) : null;
  if (ficha) return <ControlDetalle ficha={ficha} onBack={() => setSel(null)} actualizarControl={actualizarControl} onSubirFichaFisica={onSubirFichaFisica} />;

  const lista = fichas.filter(f => {
    const e = f.estadoControl || 'pendiente';
    if (filtro !== 'todas' && e !== filtro) return false;
    if (filtroAfil !== 'todas' && f.afiliadorUid !== filtroAfil) return false;
    if (search.trim()) {
      const b = search.toLowerCase().trim();
      if (!(f.dni?.toLowerCase().includes(b) || f.nombres?.toLowerCase().includes(b) || f.apellidos?.toLowerCase().includes(b))) return false;
    }
    return true;
  });

  const count = (k: string) => k === 'todas' ? fichas.length : fichas.filter(f => (f.estadoControl || 'pendiente') === k).length;
  const chips = ['todas', ...Object.keys(ESTADOS).filter(k => k !== 'firmado')];

  return (
    <div data-screen-label="Control">
      <PageHeader title="Control" sub="Seguimiento del proceso ante la JE" />
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-5">
        {chips.map(k => (
          <StatCard key={k} label={k === 'todas' ? 'Total' : ESTADOS[k].label} value={count(k)}
            accent={k === 'todas' ? null : ESTADOS[k].dot} active={filtro === k} onClick={() => setFiltro(k)} />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <Select value={filtroAfil} onChange={e => setFiltroAfil(e.target.value)} className="sm:w-56">
          <option value="todas">Todos los afiliadores</option>
          {afiliadores.map(u => <option key={u.uid} value={u.uid}>{u.nombre}</option>)}
        </Select>
        <span className="hidden sm:flex items-center text-xs font-medium text-slate-400 ml-auto">{lista.length} resultado{lista.length !== 1 ? 's' : ''}</span>
      </div>

      {lista.length === 0 ? (
        <Card><EmptyState icon="shield" title="Sin fichas en este estado" sub="Cambiá el filtro para ver otras." /></Card>
      ) : (
        <div className="space-y-2.5">
          {lista.map(f => (
            <button key={f.id} onClick={() => setSel(f.id)}
              className="w-full text-left bg-white rounded-xl ring-1 ring-slate-200 shadow-card p-3.5 flex items-center gap-3 hover:ring-brand-200 hover:bg-brand-50/30 active:scale-[0.995] transition">
              <Avatar nombre={f.nombres} apellido={f.apellidos} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">{f.apellidos}, {f.nombres}</div>
                <div className="text-xs text-slate-500 tnum truncate">{f.tipoDocumento || 'DNI'} {f.dni} · {f.localidad} · <span className="text-slate-400">{f.afiliadorNombre || f.afiliadorEmail}</span></div>
              </div>
              <StatusBadge estado={f.estadoControl || 'pendiente'} size="sm" />
              <Icon name="chevronR" className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function ControlDetalle({ ficha, onBack, actualizarControl, onSubirFichaFisica }:
  { ficha: Ficha; onBack: () => void } & Pick<ControlProps, 'actualizarControl' | 'onSubirFichaFisica'>) {
  const estado = ficha.estadoControl || 'pendiente';
  const [errorTxt, setErrorTxt] = useState(ficha.errorJE || '');
  const [accion, setAccion] = useState<null | 'error' | 'suspender' | 'baja'>(null);
  const [motivo, setMotivo] = useState('');
  const esInactivo = estado === 'suspendido' || estado === 'baja';

  return (
    <div className="max-w-3xl mx-auto" data-screen-label="Control · Detalle">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> Volver al listado
      </button>

      <Card className="p-5 md:p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar nombre={ficha.nombres} apellido={ficha.apellidos} size="lg" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{ficha.apellidos}, {ficha.nombres}</h1>
              <p className="text-xs text-slate-500 tnum mt-0.5">{ficha.tipoDocumento || 'DNI'} {ficha.dni} · Clase {ficha.clase || '—'} · {ficha.localidad}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ficha.archivoDni && <a href={ficha.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"><Icon name="doc" className="w-4 h-4" strokeWidth={2} /> DNI</a>}
            {ficha.archivoFicha && <a href={ficha.archivoFicha} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"><Icon name="doc" className="w-4 h-4" strokeWidth={2} /> Ficha</a>}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100">
          {esInactivo ? (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${estado === 'suspendido' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
              <Icon name="alert" className="w-5 h-5 shrink-0" strokeWidth={2} />
              <div className="text-sm"><span className="font-semibold">{estado === 'suspendido' ? 'Afiliado suspendido' : 'Afiliado dado de baja'}.</span>{ficha.suspendidoComentario && <span className="text-slate-500"> {ficha.suspendidoComentario}</span>}</div>
            </div>
          ) : <Stepper estado={estado} />}
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Acciones</h3>
        {estado === 'error' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-rose-50 text-rose-700 px-4 py-3 mb-4 text-sm ring-1 ring-inset ring-rose-200">
            <Icon name="alert" className="w-5 h-5 shrink-0" strokeWidth={2} />
            <div><span className="font-semibold">Error de JE:</span> {ficha.errorJE || 'Sin detalle.'}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          {estado === 'pendiente' && <Button icon="camera" onClick={() => onSubirFichaFisica(ficha.id)}>Cargar ficha física</Button>}
          {estado === 'escaneado' && <Button icon="upload" onClick={() => actualizarControl(ficha.id, 'cargado_je')}>Marcar cargada en JE</Button>}
          {estado === 'cargado_je' && (
            <>
              <Button variant="success" icon="check" onClick={() => actualizarControl(ficha.id, 'aprobado')}>Aprobar afiliación</Button>
              <Button variant="secondary" icon="alert" onClick={() => setAccion(accion === 'error' ? null : 'error')}>Registrar error</Button>
            </>
          )}
          {estado === 'error' && <Button icon="refresh" onClick={() => actualizarControl(ficha.id, 'cargado_je')}>Reintentar carga en JE</Button>}
          {estado === 'aprobado' && <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><Icon name="check" className="w-5 h-5" strokeWidth={2.5} /> Afiliación completada y aprobada.</span>}
          {esInactivo && <Button icon="refresh" onClick={() => actualizarControl(ficha.id, ficha.estadoAnterior || 'pendiente')}>Reactivar afiliado</Button>}
          {!esInactivo && (
            <div className="flex gap-2.5 ml-auto">
              <Button variant="ghost" className="text-orange-600 hover:bg-orange-50" onClick={() => setAccion(accion === 'suspender' ? null : 'suspender')}>Suspender</Button>
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setAccion(accion === 'baja' ? null : 'baja')}>Dar de baja</Button>
            </div>
          )}
        </div>

        {accion === 'error' && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            <Field label="Descripción del error de JE"><Textarea rows={2} value={errorTxt} onChange={e => setErrorTxt(e.target.value)} placeholder="Ej: DNI ilegible, datos incompletos…" /></Field>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" size="sm" onClick={() => { actualizarControl(ficha.id, 'error', { errorJE: errorTxt.trim() }); setAccion(null); }}>Guardar error</Button>
              <Button variant="ghost" size="sm" onClick={() => setAccion(null)}>Cancelar</Button>
            </div>
          </div>
        )}
        {(accion === 'suspender' || accion === 'baja') && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            <Field label={`Motivo de ${accion === 'suspender' ? 'la suspensión' : 'la baja'} (opcional)`}><Textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo…" /></Field>
            <div className="flex gap-2 mt-3">
              <Button variant={accion === 'suspender' ? 'primary' : 'danger'} size="sm"
                onClick={() => { actualizarControl(ficha.id, accion === 'suspender' ? 'suspendido' : 'baja', { estadoAnterior: estado, suspendidoComentario: motivo.trim() || null }); setAccion(null); setMotivo(''); }}>
                Confirmar {accion === 'suspender' ? 'suspensión' : 'baja'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAccion(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Historial</h3>
        <ol className="space-y-3.5">
          <HistItem dot="bg-emerald-500" label="Cargada digitalmente" por={ficha.afiliadorNombre || ficha.afiliadorEmail} />
          {['escaneado', 'cargado_je', 'aprobado', 'error'].includes(estado) && <HistItem dot="bg-violet-500" label="Ficha física escaneada" por={ficha.escaneadoPor} />}
          {['cargado_je', 'aprobado', 'error'].includes(estado) && <HistItem dot="bg-amber-500" label="Cargada en JE" por={ficha.cargadoJEPor} />}
          {estado === 'aprobado' && <HistItem dot="bg-emerald-500" label="Aprobada por JE" />}
          {estado === 'error' && <HistItem dot="bg-rose-500" label="Error de JE" detalle={ficha.errorJE} />}
          {esInactivo && <HistItem dot="bg-orange-500" label={estado === 'suspendido' ? 'Suspendido' : 'Dado de baja'} por={ficha.suspendidoPor} detalle={ficha.suspendidoComentario || undefined} />}
        </ol>
      </Card>
    </div>
  );
}

function HistItem({ dot, label, por, detalle }: { dot: string; label: string; por?: string; detalle?: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-1"><span className={`w-2.5 h-2.5 rounded-full ${dot} ring-4 ring-white`} /></div>
      <div className="min-w-0 flex-1 -mt-0.5">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {por && <div className="text-xs text-slate-500">{por}</div>}
        {detalle && <div className="text-xs text-slate-500 mt-1 bg-slate-50 rounded-md px-2.5 py-1.5 ring-1 ring-slate-100">{detalle}</div>}
      </div>
    </li>
  );
}
