// ============================================================================
//  app/components/ficha/FichaForm.tsx — Nueva / Editar ficha (form en secciones)
//  - En "Nueva": muestra banner de atajo para escanear el código del DNI.
//  - Orden de secciones: 1. Datos personales · 2. Domicilio · 3. Contacto
//    · 4. Documentación (foto DNI al final).
//  - El bloque DNI recibe callbacks para enganchar EscanerDocumento (cámara).
// ============================================================================
import { LOCALIDADES } from '../../lib/estados';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea, Segmented } from '../ui/Form';
import { Card, PageHeader } from '../ui/Primitives';

const SEXO = ['Masculino', 'Femenino'];
const ESTCIVIL = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a'];

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
  dni: {
    modo: 'escaner' | 'unico';
    setModo: (m: 'escaner' | 'unico') => void;
    frenteOk: boolean;
    dorsoOk: boolean;
    onScanFrente: () => void;
    onScanDorso: () => void;
    onPickFile: (file: File) => void;
  };
  /** Cuando está presente, se muestra el banner de "Escanear código del DNI"
   *  arriba del formulario. En modo "editar" se omite (undefined).
   *  El banner abre directamente la cámara nativa para sacar foto. */
  barcodeScan?: {
    onFotoTomada: (file: File) => void;
    aplicado: boolean;  // ya se aplicó un escaneo en esta ficha
  };
}

export function FichaForm({ formData, onChange, onSubmit, onCancel, editando, subiendo, dni, barcodeScan }: FichaFormProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto pb-24 md:pb-8" data-screen-label={editando ? 'Editar ficha' : 'Nueva ficha'}>
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4">
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> {editando ? 'Cancelar edición' : 'Volver'}
      </button>
      <PageHeader title={editando ? 'Editar ficha' : 'Nueva ficha'} sub={editando ? `${formData.apellidos}, ${formData.nombres}` : 'Cargá los datos del afiliado'} />

      {/* Banner de atajo: escanear código del DNI (solo en "nueva") */}
      {barcodeScan && !editando && (
        <BarcodeBanner onFotoTomada={barcodeScan.onFotoTomada} aplicado={barcodeScan.aplicado} />
      )}

      <Card className="px-5 md:px-7 divide-y divide-slate-100">
        <FormSection n="1" title="Datos personales" sub="Identidad del afiliado">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Apellidos" required><Input name="apellidos" required value={formData.apellidos} onChange={onChange} placeholder="Pérez" /></Field>
            <Field label="Nombres" required><Input name="nombres" required value={formData.nombres} onChange={onChange} placeholder="Juan Carlos" /></Field>
            <Field label="Tipo doc." required><Select name="tipoDocumento" value={formData.tipoDocumento} onChange={onChange}><option>DNI</option><option>LE</option><option>LC</option></Select></Field>
            <Field label="Número de documento" required><Input name="dni" required inputMode="numeric" className="tnum" value={formData.dni} onChange={onChange} placeholder="00000000" /></Field>
            <Field label="Sexo" required><Select name="sexo" required value={formData.sexo} onChange={onChange}><option value="">Seleccionar…</option>{SEXO.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Clase (año)"><Input name="clase" inputMode="numeric" maxLength={4} className="tnum" value={formData.clase} onChange={onChange} placeholder="1990" /></Field>
            <Field label="Fecha de nacimiento" required hint="DD/MM/AAAA"><Input name="fechaNacimiento" required className="tnum" value={formData.fechaNacimiento} onChange={onChange} placeholder="01/01/1990" /></Field>
            <Field label="Lugar de nacimiento"><Input name="lugarNacimiento" value={formData.lugarNacimiento} onChange={onChange} placeholder="Buenos Aires" /></Field>
            <Field label="Nacionalidad" required><Input name="nacionalidad" required value={formData.nacionalidad} onChange={onChange} /></Field>
            <Field label="Estado civil"><Select name="estadoCivil" value={formData.estadoCivil} onChange={onChange}><option value="">Seleccionar…</option>{ESTCIVIL.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Profesión" className="sm:col-span-2"><Input name="profesion" value={formData.profesion} onChange={onChange} placeholder="Opcional" /></Field>
          </div>
        </FormSection>

        <FormSection n="2" title="Domicilio" sub="Dirección del afiliado">
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

        <FormSection n="3" title="Contacto" sub="Datos de comunicación">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Celular"><Input name="celular" inputMode="tel" value={formData.celular} onChange={onChange} placeholder="11 5555 5555" /></Field>
            <Field label="Email"><Input name="mail" type="email" value={formData.mail} onChange={onChange} placeholder="correo@gmail.com" /></Field>
            <Field label="Observaciones" className="sm:col-span-2"><Textarea name="observaciones" rows={3} value={formData.observaciones} onChange={onChange} placeholder="Notas internas (opcional)" /></Field>
          </div>
        </FormSection>

        <FormSection n="4" title="Documentación" sub="Foto del DNI: frente y dorso, o un archivo único">
          <DniUploader dni={dni} />
        </FormSection>
      </Card>

      <div className="fixed md:static bottom-16 inset-x-0 md:mt-5 px-4 md:px-0 z-20">
        <div className="flex gap-2.5 bg-white/95 md:bg-transparent backdrop-blur md:backdrop-blur-0 p-3 md:p-0 rounded-xl ring-1 ring-slate-200 md:ring-0 shadow-pop md:shadow-none">
          <Button type="button" variant="secondary" className="flex-1 md:flex-none" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" icon="check" disabled={subiendo} className="flex-1 md:flex-none md:ml-auto">{subiendo ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ficha'}</Button>
        </div>
      </div>
    </form>
  );
}

function BarcodeBanner({ onFotoTomada, aplicado }: { onFotoTomada: (file: File) => void; aplicado: boolean }) {
  // El banner entero es un <label> con un <input type="file" capture="environment"> oculto.
  // Tocar el banner abre directamente la cámara nativa del celular (necesita gesto del
  // usuario para disparar la cámara — esto lo respeta porque es un click directo en el label).
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFotoTomada(f);
    e.target.value = ''; // permitir volver a sacar otra foto sin recargar el input
  };

  return (
    <label className="block w-full mb-5 cursor-pointer">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
      {aplicado ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Icon name="check" className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">Datos importados del DNI</p>
            <p className="text-xs text-emerald-700 mt-0.5">Revisá los campos. Tocá para escanear otra foto si hace falta.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-xl bg-gradient-to-br from-brand-50 to-brand-100/60 ring-1 ring-brand-200 px-4 py-4 hover:from-brand-100 hover:to-brand-200/60 transition group">
          <div className="w-11 h-11 rounded-xl bg-white ring-1 ring-brand-200 flex items-center justify-center shrink-0 group-hover:ring-brand-300 transition">
            <BarcodeIcon className="w-6 h-6 text-brand-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Escanear código del DNI</p>
            <p className="text-xs text-slate-600 mt-0.5">Sacá foto del dorso y recortá el código de barras para autocompletar nombre, apellido, DNI, sexo y fecha de nacimiento.</p>
          </div>
          <Icon name="chevronR" className="w-5 h-5 text-brand-700 shrink-0" strokeWidth={2.2} />
        </div>
      )}
    </label>
  );
}

function BarcodeIcon({ className = '' }: { className?: string }) {
  // Ícono inline (no agrego al set de Icon.tsx para minimizar diff)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.75 5.25v13.5M6.75 5.25v13.5M9.75 5.25v13.5M13.5 5.25v13.5M16.5 5.25v13.5M20.25 5.25v13.5" />
    </svg>
  );
}

function DniUploader({ dni }: { dni: FichaFormProps['dni'] }) {
  return (
    <div>
      <div className="mb-4">
        <Segmented value={dni.modo} onChange={dni.setModo}
          options={[{ value: 'escaner', label: 'Escanear', icon: 'camera' }, { value: 'unico', label: 'Archivo único', icon: 'upload' }]} />
      </div>
      {dni.modo === 'escaner' ? (
        <div className="grid grid-cols-2 gap-3">
          <DniSlot label="Frente" ok={dni.frenteOk} onClick={dni.onScanFrente} />
          <DniSlot label="Dorso" ok={dni.dorsoOk} onClick={dni.onScanDorso} />
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 cursor-pointer hover:border-brand-300 hover:bg-brand-50/40 transition">
          <Icon name="upload" className="w-7 h-7 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Subir imagen o PDF del DNI</span>
          <span className="text-xs text-slate-400">JPG, PNG o PDF</span>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files?.[0] && dni.onPickFile(e.target.files[0])} />
        </label>
      )}
      {(dni.frenteOk || dni.dorsoOk) && <p className="text-xs text-emerald-600 font-medium mt-3 flex items-center gap-1.5"><Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Documento adjuntado</p>}
    </div>
  );
}

function DniSlot({ label, ok, onClick }: { label: string; ok: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-7 transition
        ${ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40'}`}>
      <Icon name={ok ? 'check' : 'camera'} className={`w-7 h-7 ${ok ? 'text-emerald-500' : 'text-slate-400'}`} strokeWidth={ok ? 2.5 : 1.8} />
      <span className={`text-sm font-medium ${ok ? 'text-emerald-700' : 'text-slate-600'}`}>{ok ? `${label} ✓` : label}</span>
    </button>
  );
}