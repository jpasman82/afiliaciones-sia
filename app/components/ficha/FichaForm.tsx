// ============================================================================
//  app/components/ficha/FichaForm.tsx — Nueva / Editar ficha (form en secciones)
//  - En "Nueva": muestra banner de atajo para escanear el código del DNI.
//  - Orden de secciones: 1. Datos personales · 2. Domicilio · 3. Contacto
//    · 4. Documentación (foto DNI al final).
//  - El bloque DNI recibe callbacks para enganchar EscanerDocumento (cámara).
// ============================================================================
import { useRef } from 'react';
import { LOCALIDADES } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Form';
import { Card, PageHeader } from '../ui/Primitives';

const SEXO = ['Masculino', 'Femenino'];
const ESTCIVIL = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a'];
const PROFESIONES = [
  'Empleado/a',
  'Jubilado/a o pensionado/a',
  'Autonomo/a',
  'Monotributista',
  'Comerciante',
  'Profesional',
  'Estudiante',
  'Ama de casa',
  'Desocupado/a',
  'Otro',
];

export function FormSection({ n, title, sub, children }:
  { n: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="grid md:grid-cols-[220px_1fr] gap-4 md:gap-8 py-6 border-b border-slate-100 last:border-0">
      <div className="md:pt-1">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        {sub && <p className="text-xs text-slate-400 mt-1.5 md:ml-8">{sub}</p>}
      </div>
      <div>{children}</div>
    </section>
  );
}

interface FichaFormProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  editando: boolean;
  subiendo?: boolean;
  publicLink?: string | null;
  creandoPublicLink?: boolean;
  onCrearPublicLink?: () => void;
  hideBackButton?: boolean;
  hideCancelButton?: boolean;
  submitLabel?: string;
  dni: {
    modo: 'escaner' | 'unico';
    setModo: (m: 'escaner' | 'unico') => void;
    frenteOk: boolean;
    dorsoOk: boolean;
    fotoFrente?: string | null;
    fotoDorso?: string | null;
    procesandoArchivo?: boolean;
    onScanFrente: () => void;
    onScanDorso: () => void;
    onPickFile: (file: File) => void;
    onScanDniData?: () => void;
    onScanBarcode?: () => void;
  };
  /** Estado del intento de auto-decode del PDF417 del DNI tras sacar foto.
   *  Se muestra como spinner / ✓ / mensaje de fallo en la sección Documentación. */
  decodeStatus?: 'idle' | 'processing' | 'success' | 'failed';
}

export function FichaForm({ formData, onChange, onSubmit, onCancel, editando, subiendo, publicLink, creandoPublicLink, onCrearPublicLink, hideBackButton, hideCancelButton, submitLabel, dni, decodeStatus }: FichaFormProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto pb-24 md:pb-8" data-screen-label={editando ? 'Editar ficha' : 'Nueva ficha'}>
      <button type="button" onClick={onCancel} className={`${hideBackButton ? 'hidden' : 'inline-flex'} items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4`}>
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> {editando ? 'Cancelar edición' : 'Volver'}
      </button>
      <PageHeader title={editando ? 'Editar ficha' : 'Nueva ficha'} sub={editando ? `${formData.apellidos}, ${formData.nombres}` : 'Cargá los datos del afiliado'} />

      <Card className="px-5 md:px-7 divide-y divide-slate-100">
        <FormSection n="1" title="Documentación" sub="Foto del DNI: frente y dorso, o un archivo único">
          <DniUploader dni={dni} />
          {decodeStatus && decodeStatus !== 'idle' && <DecodeStatusIndicator status={decodeStatus} />}
          {onCrearPublicLink && !editando && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <button
                type="button"
                onClick={onCrearPublicLink}
                disabled={creandoPublicLink}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:bg-slate-950 transition disabled:opacity-60"
              >
                {creandoPublicLink ? 'Generando link...' : 'Generar link de carga publica'}
              </button>
              {publicLink && (
                <div className="mt-3 rounded-lg bg-white ring-1 ring-slate-200 p-2">
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Valido por 24 horas y un solo uso</p>
                  <input readOnly value={publicLink} className="w-full bg-transparent text-xs text-slate-700 outline-none" onFocus={e => e.currentTarget.select()} />
                </div>
              )}
            </div>
          )}
        </FormSection>

        <FormSection n="2" title="Datos personales" sub="Identidad del afiliado">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Apellidos" required><Input name="apellidos" required value={formData.apellidos} onChange={onChange} placeholder="Pérez" /></Field>
            <Field label="Nombres" required><Input name="nombres" required value={formData.nombres} onChange={onChange} placeholder="Juan Carlos" /></Field>
            <Field label="Tipo doc." required><Select name="tipoDocumento" required value={formData.tipoDocumento} onChange={onChange}><option>DNI</option><option>LE</option><option>LC</option></Select></Field>
            <Field label="Número de documento" required><Input name="dni" required inputMode="numeric" className="tnum" value={formData.dni} onChange={onChange} placeholder="00000000" /></Field>
            <Field label="Sexo" required><Select name="sexo" required value={formData.sexo} onChange={onChange}><option value="">Seleccionar…</option>{SEXO.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Clase (año)" required><Input name="clase" required inputMode="numeric" maxLength={4} className="tnum" value={formData.clase} onChange={onChange} placeholder="1990" /></Field>
            <Field label="Fecha de nacimiento" required hint="DD/MM/AAAA"><Input name="fechaNacimiento" required className="tnum" value={formData.fechaNacimiento} onChange={onChange} placeholder="01/01/1990" /></Field>
            <Field label="Lugar de nacimiento" required><Input name="lugarNacimiento" required value={formData.lugarNacimiento} onChange={onChange} placeholder="Buenos Aires" /></Field>
            <Field label="Nacionalidad" required><Input name="nacionalidad" required value={formData.nacionalidad} onChange={onChange} /></Field>
            <Field label="Estado civil" required><Select name="estadoCivil" required value={formData.estadoCivil} onChange={onChange}><option value="">Seleccionar…</option>{ESTCIVIL.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Profesión" required className="sm:col-span-2"><Select name="profesion" required value={formData.profesion} onChange={onChange}><option value="">Seleccionar…</option>{PROFESIONES.map(p => <option key={p}>{p}</option>)}</Select></Field>
          </div>
        </FormSection>

        <FormSection n="3" title="Domicilio" sub="Dirección del afiliado">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Distrito"><Input name="distrito" value={formData.distrito} disabled className="bg-slate-50 text-slate-500" /></Field>
            <Field label="Localidad" required><Select name="localidad" required value={formData.localidad} onChange={onChange}><option value="">Seleccionar…</option>{LOCALIDADES.map(l => <option key={l}>{l}</option>)}</Select></Field>
            <Field label="Calle" required className="sm:col-span-2"><Input name="calle" required value={formData.calle} onChange={onChange} placeholder="Av. del Libertador" /></Field>
            <Field label="Número" required><Input name="numero" required inputMode="numeric" className="tnum" value={formData.numero} onChange={onChange} placeholder="1234" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Piso"><Input name="piso" value={formData.piso} onChange={onChange} /></Field>
              <Field label="Dpto"><Input name="dpto" value={formData.dpto} onChange={onChange} /></Field>
            </div>
          </div>
        </FormSection>

        <FormSection n="4" title="Contacto" sub="Datos de comunicación">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Celular"><Input name="celular" inputMode="tel" value={formData.celular} onChange={onChange} placeholder="11 5555 5555" /></Field>
            <Field label="Email"><Input name="mail" type="email" value={formData.mail} onChange={onChange} placeholder="correo@gmail.com" /></Field>
            <Field label="Observaciones" className="sm:col-span-2"><Textarea name="observaciones" rows={3} value={formData.observaciones} onChange={onChange} placeholder="Notas internas (opcional)" /></Field>
          </div>
        </FormSection>
      </Card>

      <div className="fixed md:static bottom-16 inset-x-0 md:mt-5 px-4 md:px-0 z-20">
        <div className="flex gap-2.5 bg-white/95 md:bg-transparent backdrop-blur md:backdrop-blur-0 p-3 md:p-0 rounded-xl ring-1 ring-slate-200 md:ring-0 shadow-pop md:shadow-none">
          {!hideCancelButton && <Button type="button" variant="secondary" className="flex-1 md:flex-none" onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" icon="check" disabled={subiendo} className="flex-1 md:flex-none md:ml-auto">{subiendo ? 'Guardando…' : submitLabel || (editando ? 'Guardar cambios' : 'Crear ficha')}</Button>
        </div>
      </div>
    </form>
  );
}

function DniUploader({ dni }: { dni: FichaFormProps['dni'] }) {
  const archivoInputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      {dni.onScanDniData && (
        <button type="button" onClick={dni.onScanDniData}
          className="mb-4 w-full py-3 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 active:bg-brand-800 transition flex items-center justify-center gap-2 shadow-sm">
          <BarcodeIcon className="w-5 h-5" /> Escanear DNI: frente y dorso
        </button>
      )}
      <button
        type="button"
        onClick={() => archivoInputRef.current?.click()}
        disabled={dni.procesandoArchivo}
        className="mb-4 w-full py-3 rounded-xl bg-white text-slate-700 ring-1 ring-slate-200 font-bold text-sm hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Icon name="upload" className="w-5 h-5" /> Subir archivo único
      </button>
      <input
        ref={archivoInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        disabled={dni.procesandoArchivo}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) dni.onPickFile(file);
          e.target.value = '';
        }}
      />
      <>
        <div className="grid grid-cols-2 gap-3">
          <DniSlot label="Frente" ok={dni.frenteOk} preview={dni.fotoFrente} onClick={dni.onScanFrente} />
          <DniSlot label="Dorso" ok={dni.dorsoOk} preview={dni.fotoDorso} onClick={dni.onScanDorso} />
        </div>
        <p className="mt-2 text-center text-xs font-medium text-slate-500">
          Subir archivos separados
        </p>
      </>
      {dni.procesandoArchivo && <p className="text-xs text-slate-500 font-medium mt-3">Procesando archivo del DNI…</p>}
      {(dni.frenteOk || dni.dorsoOk) && <p className="text-xs text-emerald-600 font-medium mt-3 flex items-center gap-1.5"><Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Documento adjuntado</p>}
      {dni.onScanBarcode && (dni.frenteOk || dni.dorsoOk) && (
        <button type="button" onClick={dni.onScanBarcode}
          className="mt-4 w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:bg-slate-950 transition flex items-center justify-center gap-2">
          <BarcodeIcon className="w-5 h-5" /> Reintentar lectura del código
        </button>
      )}
    </div>
  );
}

function BarcodeIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.75 5.25v13.5M6.75 5.25v13.5M9.75 5.25v13.5M13.5 5.25v13.5M16.5 5.25v13.5M20.25 5.25v13.5" />
    </svg>
  );
}

function DniSlot({ label, ok, preview, onClick }: { label: string; ok: boolean; preview?: string | null; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative flex aspect-[1.58] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition ${preview ? '[&>svg]:opacity-0 [&>span]:opacity-0' : ''}
        ${ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40'}`}>
      <Icon name={ok ? 'check' : 'camera'} className={`w-7 h-7 ${ok ? 'text-emerald-500' : 'text-slate-400'}`} strokeWidth={ok ? 2.5 : 1.8} />
      {preview && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute left-2 top-2 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            {label}
          </div>
          <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1 text-emerald-600 shadow-sm">
            <Icon name="check" className="w-4 h-4" strokeWidth={2.7} />
          </div>
        </>
      )}
      <span className={`text-sm font-medium ${ok ? 'text-emerald-700' : 'text-slate-600'}`}>{ok ? `${label} ✓` : label}</span>
    </button>
  );
}

function DecodeStatusIndicator({ status }: { status: 'processing' | 'success' | 'failed' }) {
  if (status === 'processing') {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin" />
        <span>Leyendo código del DNI…</span>
      </div>
    );
  }
  if (status === 'success') {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 font-semibold">
        <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
        <span>Datos del DNI leídos automáticamente — revisalos abajo.</span>
      </div>
    );
  }
  // failed
  return (
    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700">
      <span className="text-base leading-none mt-px">⚠</span>
      <span>No se pudo leer el código del DNI. Cargá los datos manualmente abajo.</span>
    </div>
  );
}
