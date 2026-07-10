// ============================================================================
//  app/components/ficha/FichaDetalle.tsx - Detalle de ficha
// ============================================================================
import { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import type { Ficha, Rol } from '../../lib/types';
import { storage } from '../../../firebaseConfig';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badges';
import { Avatar, Card } from '../ui/Primitives';

export function FichaDetalle({ ficha, role, onBack, onEdit, onDelete }:
  { ficha: Ficha; role: Rol; onBack: () => void; onEdit: (f: Ficha) => void; onDelete?: () => void | Promise<void> }) {
  const estado = ficha.estadoControl || 'pendiente';
  const puedeEditar = role === 'admin' || estado === 'pendiente';
  const puedeEliminar = !!onDelete && (role === 'admin' || estado === 'pendiente');
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const handleEliminar = async () => {
    if (eliminando) return;
    setEliminando(true);
    try {
      await onDelete?.();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto" data-screen-label="Detalle de ficha">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> Volver
      </button>

      {confirmarBorrar && (
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 p-4 mb-4">
          <div className="flex items-start gap-3">
            <Icon name="alert" className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" strokeWidth={2} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-900">¿Eliminar esta ficha?</p>
              <p className="text-sm text-rose-700 mt-1">Esta acción es irreversible. Se eliminará el registro de <span className="font-semibold">{ficha.apellidos}, {ficha.nombres}</span> (DNI {ficha.dni}) de forma permanente.</p>
              <div className="flex gap-2 mt-3">
                <Button variant="danger" size="sm" icon="trash" onClick={handleEliminar} disabled={eliminando}>{eliminando ? 'Eliminando…' : 'Sí, eliminar'}</Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmarBorrar(false)}>Cancelar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {puedeEliminar && !confirmarBorrar && (
              <Button variant="ghost" size="sm" icon="trash" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirmarBorrar(true)}>Eliminar</Button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-5 border-t border-slate-100">
          <Dato label="Nacimiento">{ficha.fechaNacimiento}</Dato>
          <Dato label="Clase">{ficha.clase}</Dato>
          <Dato label="Sexo">{ficha.sexo}</Dato>
          <Dato label="Nacionalidad">{ficha.nacionalidad}</Dato>
          <Dato label="Lugar nac.">{ficha.lugarNacimiento}</Dato>
          <Dato label="Estado civil">{ficha.estadoCivil}</Dato>
          <Dato label="Profesion">{ficha.profesion}</Dato>
          <Dato label="Localidad">{ficha.localidad}</Dato>
          <Dato label="Direccion" wide>{ficha.calle} {ficha.numero}{ficha.piso ? `, Piso ${ficha.piso}` : ''}{ficha.dpto ? ` Dpto ${ficha.dpto}` : ''}</Dato>
          <Dato label="Celular">{ficha.celular}</Dato>
          <Dato label="Email">{ficha.mail}</Dato>
          {ficha.observaciones && <Dato label="Observaciones" wide>{ficha.observaciones}</Dato>}
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Documentacion</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <ArchivoRow label="DNI" path={ficha.archivoDniPath} url={ficha.archivoDni} />
          <ArchivoRow label="Ficha fisica" path={ficha.archivoFichaPath} url={ficha.archivoFicha} />
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
          Cargada por <span className="font-medium text-slate-500">{ficha.afiliadorNombre || ficha.afiliadorEmail}</span>
        </div>
      </Card>
    </div>
  );
}

function Dato({ label, children, wide }: { label: string; children?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-4' : ''}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm font-medium text-slate-800 mt-0.5">{children || <span className="text-slate-300">-</span>}</dd>
    </div>
  );
}

function ArchivoRow({ label, path, url }: { label: string; path?: string; url?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const disponible = !!path || !!url;

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
    <div className={`flex items-center gap-3 rounded-lg px-3.5 py-3 ring-1 ring-inset ${disponible ? 'bg-white ring-slate-200' : 'bg-slate-50 ring-slate-200'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${disponible ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-300'}`}>
        <Icon name="doc" className="w-5 h-5" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{disponible ? 'Adjuntado' : 'No cargado'}</div>
      </div>
      {disponible ? (
        <button type="button" onClick={abrir} disabled={cargando} className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-2 disabled:text-slate-300">
          {cargando ? 'Abriendo...' : 'Ver'}
        </button>
      ) : <span className="text-xs text-slate-300 font-medium pr-1">-</span>}
    </div>
  );
}
