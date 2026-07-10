// ============================================================================
//  app/components/control/ControlView.tsx — Módulo de Control (solo admin)
//  Acciones vía callbacks que conectás a tus handlers de page.tsx:
//   - actualizarControl(id, estado, extras)  (tu updateDoc actual)
//   - onSubirFichaFisica(id)                 (abre cámara / archivo → escaneado)
// ============================================================================
import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import type { Ficha } from '../../lib/types';
import { storage } from '../../../firebaseConfig';
import { ESTADOS } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Select, Field, Textarea } from '../ui/Form';
import { StatusBadge } from '../ui/Badges';
import { Avatar, Card, StatCard, PageHeader, EmptyState } from '../ui/Primitives';
import { Stepper } from '../ui/Stepper';

interface ControlProps {
  fichas: Ficha[];
  search: string;
  afiliadores: { uid: string; nombre: string }[];
  actualizarControl: (id: string, estado: string, extras?: Record<string, any>) => void | Promise<void>;
  onSubirFichaFisica: (id: string) => void;
  onOpenFicha: (id: string) => void;
  subiendoControl?: boolean;
}

export function ControlView({ fichas, search, afiliadores, actualizarControl, onSubirFichaFisica, onOpenFicha, subiendoControl }: ControlProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('todas');
  const [filtroAfil, setFiltroAfil] = useState('todas');

  const ficha = sel ? fichas.find(f => f.id === sel) : null;
  if (ficha) return <ControlDetalle ficha={ficha} onBack={() => setSel(null)} actualizarControl={actualizarControl} onSubirFichaFisica={onSubirFichaFisica} onOpenFicha={onOpenFicha} subiendoControl={subiendoControl} />;

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
          {lista.map(f => {
            const fechaCarga = formatearFechaCorta(f.fecha);
            return (
            <button key={f.id} onClick={() => setSel(f.id)}
              className="w-full text-left bg-white rounded-xl ring-1 ring-slate-200 shadow-card p-3.5 flex items-center gap-3 hover:ring-brand-200 hover:bg-brand-50/30 active:scale-[0.995] transition">
              <Avatar nombre={f.nombres} apellido={f.apellidos} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 truncate">{f.apellidos}, {f.nombres}</div>
                <div className="text-xs text-slate-500 tnum truncate">{f.tipoDocumento || 'DNI'} {f.dni} · {f.localidad} · <span className="text-slate-400">{f.afiliadorNombre || f.afiliadorEmail}</span>{fechaCarga && <span className="text-slate-400"> · Cargada {fechaCarga}</span>}</div>
              </div>
              <StatusBadge estado={f.estadoControl || 'pendiente'} size="sm" />
              <Icon name="chevronR" className="w-4 h-4 text-slate-300 shrink-0" strokeWidth={2.5} />
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function ControlDetalle({ ficha, onBack, actualizarControl, onSubirFichaFisica, onOpenFicha, subiendoControl }:
  { ficha: Ficha; onBack: () => void } & Pick<ControlProps, 'actualizarControl' | 'onSubirFichaFisica' | 'onOpenFicha' | 'subiendoControl'>) {
  const estado = ficha.estadoControl || 'pendiente';
  const [errorTxt, setErrorTxt] = useState(ficha.errorJE || '');
  const [accion, setAccion] = useState<null | 'error' | 'suspender' | 'baja' | 'reactivar'>(null);
  const [motivo, setMotivo] = useState('');
  const [accionando, setAccionando] = useState<string | null>(null);
  const ocupado = accionando !== null || !!subiendoControl;
  const esInactivo = estado === 'suspendido' || estado === 'baja';
  const historial = normalizarHistorial(ficha);

  const ejecutarControl = async (nuevoEstado: string, extras?: Record<string, any>) => {
    if (ocupado) return;
    setAccionando(nuevoEstado);
    try {
      await actualizarControl(ficha.id, nuevoEstado, extras);
    } finally {
      setAccionando(null);
    }
  };

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
              <p className="text-xs text-slate-500 tnum mt-0.5">{ficha.tipoDocumento || 'DNI'} {ficha.dni} · Clase {ficha.clase || '—'} · {ficha.localidad}{formatearFechaCorta(ficha.fecha) && <span> · Cargada {formatearFechaCorta(ficha.fecha)}</span>}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" size="sm" icon="doc" onClick={() => onOpenFicha(ficha.id)}>Ver ficha completa</Button>
            {(ficha.archivoDniPath || ficha.archivoDni) && <ArchivoButton label="DNI" path={ficha.archivoDniPath} url={ficha.archivoDni} />}
            {(ficha.archivoFichaPath || ficha.archivoFicha) && <ArchivoButton label="Ficha" path={ficha.archivoFichaPath} url={ficha.archivoFicha} />}
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
          {estado === 'pendiente' && <Button icon="camera" disabled={ocupado} onClick={() => onSubirFichaFisica(ficha.id)}>{subiendoControl ? 'Subiendo ficha…' : 'Cargar ficha física'}</Button>}
          {estado === 'escaneado' && <Button icon="upload" disabled={ocupado} onClick={() => ejecutarControl('cargado_je')}>{accionando === 'cargado_je' ? 'Marcando…' : 'Marcar cargada en JE'}</Button>}
          {estado === 'cargado_je' && (
            <>
              <Button variant="success" icon="check" disabled={ocupado} onClick={() => ejecutarControl('aprobado')}>{accionando === 'aprobado' ? 'Aprobando…' : 'Aprobar afiliación'}</Button>
              <Button variant="secondary" icon="alert" disabled={ocupado} onClick={() => setAccion(accion === 'error' ? null : 'error')}>Registrar error</Button>
            </>
          )}
          {estado === 'error' && <Button icon="refresh" disabled={ocupado} onClick={() => ejecutarControl('cargado_je')}>{accionando === 'cargado_je' ? 'Marcando…' : 'Reintentar carga en JE'}</Button>}
          {estado === 'aprobado' && <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><Icon name="check" className="w-5 h-5" strokeWidth={2.5} /> Afiliación completada y aprobada.</span>}
          {esInactivo && <Button icon="refresh" disabled={ocupado} onClick={() => setAccion(accion === 'reactivar' ? null : 'reactivar')}>Reactivar afiliado</Button>}
          {!esInactivo && (
            <div className="flex gap-2.5 ml-auto">
              <Button variant="ghost" className="text-orange-600 hover:bg-orange-50" disabled={ocupado} onClick={() => setAccion(accion === 'suspender' ? null : 'suspender')}>Suspender</Button>
              <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" disabled={ocupado} onClick={() => setAccion(accion === 'baja' ? null : 'baja')}>Dar de baja</Button>
            </div>
          )}
        </div>

        {accion === 'error' && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            <Field label="Descripción del error de JE"><Textarea rows={2} value={errorTxt} onChange={e => setErrorTxt(e.target.value)} placeholder="Ej: DNI ilegible, datos incompletos…" /></Field>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" size="sm" disabled={ocupado} onClick={async () => { await ejecutarControl('error', { errorJE: errorTxt.trim() }); setAccion(null); }}>{accionando === 'error' ? 'Guardando…' : 'Guardar error'}</Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setAccion(null)}>Cancelar</Button>
            </div>
          </div>
        )}
        {(accion === 'suspender' || accion === 'baja') && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            <Field label={`Motivo de ${accion === 'suspender' ? 'la suspensión' : 'la baja'} (opcional)`}><Textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo…" /></Field>
            <div className="flex gap-2 mt-3">
              <Button variant={accion === 'suspender' ? 'primary' : 'danger'} size="sm" disabled={ocupado}
                onClick={async () => { await ejecutarControl(accion === 'suspender' ? 'suspendido' : 'baja', { estadoAnterior: estado, suspendidoComentario: motivo.trim() || null }); setAccion(null); setMotivo(''); }}>
                {accionando ? 'Guardando…' : `Confirmar ${accion === 'suspender' ? 'suspensión' : 'baja'}`}
              </Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => setAccion(null)}>Cancelar</Button>
            </div>
          </div>
        )}
        {accion === 'reactivar' && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 ring-1 ring-slate-200">
            <Field label="Comentario de reactivación (opcional)">
              <Textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo o aclaración…" />
            </Field>
            <div className="flex gap-2 mt-3">
              <Button size="sm" disabled={ocupado}
                onClick={async () => { await ejecutarControl(ficha.estadoAnterior || 'pendiente', { reactivacionComentario: motivo.trim() || null }); setAccion(null); setMotivo(''); }}>
                {accionando ? 'Guardando…' : 'Confirmar reactivación'}
              </Button>
              <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => { setAccion(null); setMotivo(''); }}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Historial</h3>
        <ol className="space-y-3.5">
          {historial.map((item, idx) => (
            <HistItem
              key={`${item.fecha || item.label}-${idx}`}
              dot={item.dot}
              label={item.label}
              por={item.por}
              fecha={item.fecha}
              detalle={item.detalle}
            />
          ))}
        </ol>
      </Card>
    </div>
  );
}

type HistorialUI = {
  dot: string;
  label: string;
  por?: string;
  fecha?: string;
  detalle?: string;
};

function normalizarHistorial(ficha: Ficha): HistorialUI[] {
  const historial = Array.isArray(ficha.historialControl) ? ficha.historialControl : [];

  const items: HistorialUI[] = historial.length > 0
    ? historial
        .slice()
        .sort((a: any, b: any) => fechaMillis(b.fecha) - fechaMillis(a.fecha))
        .map((item: any) => {
          const estado = item.estadoNuevo || item.estado || item.accion;
          const anterior = item.estadoAnterior;
          const label = item.accion === 'reactivacion'
            ? `Reactivado a ${labelEstado(estado)}`
            : anterior
              ? `${labelEstado(anterior)} -> ${labelEstado(estado)}`
              : labelEstado(estado);

          return {
            dot: dotEstado(estado, item.accion),
            label,
            por: item.por,
            fecha: formatearFechaHistorial(item.fecha),
            detalle: item.comentario || undefined,
          };
        })
    : historialDesdeCampos(ficha);

  // La carga inicial no está en historialControl (solo registra transiciones de control).
  items.push({
    dot: 'bg-emerald-500',
    label: 'Cargada digitalmente',
    por: ficha.afiliadorNombre || ficha.afiliadorEmail,
    fecha: formatearFechaHistorial(ficha.fecha),
  });

  return items;
}

// Fichas anteriores a historialControl: se reconstruye desde los timestamps por estado.
function historialDesdeCampos(ficha: Ficha): HistorialUI[] {
  const estado = ficha.estadoControl || 'pendiente';
  const items: HistorialUI[] = [];

  if (estado === 'suspendido' || estado === 'baja') {
    items.push({
      dot: 'bg-orange-500',
      label: estado === 'suspendido' ? 'Suspendido' : 'Dado de baja',
      por: ficha.suspendidoPor,
      fecha: formatearFechaHistorial(estado === 'baja' ? (ficha.fechaBaja || ficha.fechaSuspension) : ficha.fechaSuspension),
      detalle: ficha.suspendidoComentario || undefined,
    });
  }
  if (estado === 'error') {
    items.push({ dot: 'bg-rose-500', label: 'Error de JE', por: ficha.errorPor, fecha: formatearFechaHistorial(ficha.fechaErrorJE || ficha.fechaError), detalle: ficha.errorJE });
  }
  if (estado === 'aprobado') {
    items.push({ dot: 'bg-emerald-500', label: 'Aprobada por JE', por: ficha.aprobadoPor, fecha: formatearFechaHistorial(ficha.fechaAprobacion) });
  }
  if (['cargado_je', 'aprobado', 'error'].includes(estado)) {
    items.push({ dot: 'bg-amber-500', label: 'Cargada en JE', por: ficha.cargadoJEPor, fecha: formatearFechaHistorial(ficha.fechaCargaJE || ficha.fechaCargadoJE) });
  }
  if (['escaneado', 'cargado_je', 'aprobado', 'error'].includes(estado)) {
    items.push({ dot: 'bg-violet-500', label: 'Ficha física escaneada', por: ficha.escaneadoPor, fecha: formatearFechaHistorial(ficha.fechaEscaneado) });
  }

  return items;
}

function labelEstado(estado?: string) {
  if (!estado) return 'Sin estado';
  return ESTADOS[estado]?.label || estado.replace(/_/g, ' ');
}

function dotEstado(estado?: string, accion?: string) {
  if (accion === 'reactivacion') return 'bg-sky-500';
  if (estado === 'baja' || estado === 'error') return 'bg-rose-500';
  if (estado === 'suspendido') return 'bg-orange-500';
  if (estado === 'aprobado') return 'bg-emerald-500';
  if (estado === 'cargado_je') return 'bg-amber-500';
  if (estado === 'escaneado') return 'bg-violet-500';
  return 'bg-slate-400';
}

function formatearFechaHistorial(fecha: any) {
  if (!fecha) return undefined;
  try {
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return undefined;
  }
}

function formatearFechaCorta(fecha: any) {
  const ms = fechaMillis(fecha);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fechaMillis(fecha: any) {
  if (!fecha) return 0;
  try {
    const date = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

function ArchivoButton({ label, path, url }: { label: string; path?: string; url?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const abrir = async () => {
    if (url && !path) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!path) return;

    setCargando(true);
    try {
      const blob = await getBlob(ref(storage, path));
      const objectUrl = URL.createObjectURL(blob);
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={cargando}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 disabled:text-slate-300"
    >
      <Icon name="doc" className="w-4 h-4" strokeWidth={2} />
      {cargando ? 'Abriendo...' : label}
    </button>
  );
}

function HistItem({ dot, label, por, fecha, detalle }: HistorialUI) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center pt-1"><span className={`w-2.5 h-2.5 rounded-full ${dot} ring-4 ring-white`} /></div>
      <div className="min-w-0 flex-1 -mt-0.5">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {(por || fecha) && <div className="text-xs text-slate-500">{por || 'Sin operador'}{fecha ? ` - ${fecha}` : ''}</div>}
        {detalle && <div className="text-xs text-slate-500 mt-1 bg-slate-50 rounded-md px-2.5 py-1.5 ring-1 ring-slate-100">{detalle}</div>}
      </div>
    </li>
  );
}
