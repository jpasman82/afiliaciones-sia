// ============================================================================
//  app/components/ficha/FichaDetalle.tsx — Detalle de ficha
// ============================================================================
import type { Ficha, Rol } from '../../lib/types';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badges';
import { Avatar, Card } from '../ui/Primitives';

export function FichaDetalle({ ficha, role, onBack, onEdit }:
  { ficha: Ficha; role: Rol; onBack: () => void; onEdit: (f: Ficha) => void }) {
  const estado = ficha.estadoControl || 'pendiente';
  const avanzado = ['cargado_je', 'aprobado', 'error', 'suspendido', 'baja'].includes(estado);
  const puedeEditar = role === 'admin' || !avanzado;

  const Dato = ({ label, children, wide }: { label: string; children?: React.ReactNode; wide?: boolean }) => (
    <div className={wide ? 'col-span-2 md:col-span-4' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 mt-0.5">{children || <span className="text-slate-300">—</span>}</dd>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto" data-screen-label="Detalle de ficha">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> Volver
      </button>

      <Card className="p-5 md:p-6 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <Avatar nombre={ficha.nombres} apellido={ficha.apellidos} size="lg" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">{ficha.apellidos}, {ficha.nombres}</h1>
              <p className="text-xs text-slate-500 tnum mt-0.5">{ficha.tipoDocumento || 'DNI'} {ficha.dni}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge estado={estado} />
            {puedeEditar && <Button variant="secondary" size="sm" icon="edit" onClick={() => onEdit(ficha)}>Editar</Button>}
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-5 border-t border-slate-100">
          <Dato label="Nacimiento">{ficha.fechaNacimiento}</Dato>
          <Dato label="Clase">{ficha.clase}</Dato>
          <Dato label="Sexo">{ficha.sexo}</Dato>
          <Dato label="Nacionalidad">{ficha.nacionalidad}</Dato>
          <Dato label="Lugar nac.">{ficha.lugarNacimiento}</Dato>
          <Dato label="Estado civil">{ficha.estadoCivil}</Dato>
          <Dato label="Profesión">{ficha.profesion}</Dato>
          <Dato label="Localidad">{ficha.localidad}</Dato>
          <Dato label="Dirección" wide>{ficha.calle} {ficha.numero}{ficha.piso ? `, Piso ${ficha.piso}` : ''}{ficha.dpto ? ` Dpto ${ficha.dpto}` : ''}</Dato>
          <Dato label="Celular">{ficha.celular}</Dato>
          <Dato label="Email">{ficha.mail}</Dato>
          {ficha.observaciones && <Dato label="Observaciones" wide>{ficha.observaciones}</Dato>}
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Documentación</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <ArchivoRow label="DNI" url={ficha.archivoDni} />
          <ArchivoRow label="Ficha física" url={ficha.archivoFicha} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
          Cargada por <span className="font-medium text-slate-500">{ficha.afiliadorNombre || ficha.afiliadorEmail}</span>
        </div>
      </Card>
    </div>
  );
}

function ArchivoRow({ label, url }: { label: string; url?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3.5 py-3 ring-1 ring-inset ${url ? 'bg-white ring-slate-200' : 'bg-slate-50 ring-slate-200'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${url ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-300'}`}><Icon name="doc" className="w-5 h-5" strokeWidth={2} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{url ? 'Adjuntado' : 'No cargado'}</div>
      </div>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-2">Ver</a> : <span className="text-xs text-slate-300 font-medium pr-1">—</span>}
    </div>
  );
}
