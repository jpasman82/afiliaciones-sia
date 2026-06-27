// ============================================================================
//  app/components/ficha/FichaForm.tsx — Nueva / Editar ficha (form en secciones)
//
//  Rediseño del bloque "Documentación":
//  - Pregunta clara arriba: "¿Cómo cargás el DNI?"
//  - Botón "¿Qué hace cada uno?" con panel de ayuda desplegable.
//  - Jerarquía visual: online (Didit) destaca; offline son secundarias.
//  - Bloque "¿El afiliado no está con vos?" al final → link público compartible.
//
//  La lógica original (props, callbacks, decodeStatus, Didit, etc.) NO cambió:
//  el componente sigue siendo presentacional y todos los handlers se reciben
//  por props desde page.tsx.
// ============================================================================
'use client';
import { useRef, useState } from 'react';
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

export function FormSection({ n, title, sub, children, anchorId }:
  { n: string; title: string; sub?: string; children: React.ReactNode; anchorId?: string }) {
  return (
    <section id={anchorId} className="grid md:grid-cols-[220px_1fr] gap-4 md:gap-8 py-6 border-b border-slate-100 last:border-0 scroll-mt-24">
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
  decodeStatus?: 'idle' | 'processing' | 'success' | 'failed';
  diditLoading?: boolean;
  diditError?: string | null;
  diditMensajePendiente?: string | null;
  diditAutocompleted?: boolean;
  diditCamposAutocompletados?: Set<string>;
  onIniciarSesionDidit?: () => void;
  iniciandoSesionDidit?: boolean;
}

export function FichaForm({
  formData, onChange, onSubmit, onCancel, editando, subiendo,
  publicLink, creandoPublicLink, onCrearPublicLink,
  hideBackButton, hideCancelButton, submitLabel,
  dni, decodeStatus,
  diditLoading, diditError, diditMensajePendiente, diditAutocompleted, diditCamposAutocompletados,
  onIniciarSesionDidit, iniciandoSesionDidit,
}: FichaFormProps) {
  const af = (name: string) => {
    if (diditCamposAutocompletados?.has(name)) return '!ring-2 !ring-emerald-400 bg-emerald-50';
    if (diditAutocompleted && !formData[name]) return '!ring-2 !ring-amber-400 bg-amber-50/40';
    return '';
  };
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto pb-24 md:pb-8" data-screen-label={editando ? 'Editar ficha' : 'Nueva ficha'}>
      <button type="button" onClick={onCancel} className={`${hideBackButton ? 'hidden' : 'inline-flex'} items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 mb-4`}>
        <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2.2} /> {editando ? 'Cancelar edición' : 'Volver'}
      </button>
      <PageHeader title={editando ? 'Editar ficha' : 'Nueva ficha'} sub={editando ? `${formData.apellidos}, ${formData.nombres}` : 'Cargá los datos del afiliado'} />

      {diditAutocompleted && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <p className="text-sm text-emerald-800 font-medium">Datos extraídos del DNI automáticamente. Verificá que sean correctos y completá los campos faltantes.</p>
        </div>
      )}

      <Card className="px-5 md:px-7 divide-y divide-slate-100">
        <FormSection n="1" title="Documentación" sub="Foto del DNI: frente y dorso">
          <DniUploader
            dni={dni}
            onIniciarSesionDidit={onIniciarSesionDidit}
            iniciandoSesionDidit={iniciandoSesionDidit}
            diditLoading={diditLoading}
            diditError={diditError}
            diditMensajePendiente={diditMensajePendiente}
            publicLink={publicLink}
            creandoPublicLink={creandoPublicLink}
            onCrearPublicLink={!editando ? onCrearPublicLink : undefined}
          />
          {decodeStatus && decodeStatus !== 'idle' && <DecodeStatusIndicator status={decodeStatus} />}
        </FormSection>

        <FormSection n="2" title="Datos personales" sub="Identidad del afiliado" anchorId="datos-precargados">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Apellidos" required><Input name="apellidos" required value={formData.apellidos} onChange={onChange} placeholder="Pérez" className={af('apellidos')} /></Field>
            <Field label="Nombres" required><Input name="nombres" required value={formData.nombres} onChange={onChange} placeholder="Juan Carlos" className={af('nombres')} /></Field>
            <Field label="Tipo doc." required><Select name="tipoDocumento" required value={formData.tipoDocumento} onChange={onChange}><option>DNI</option><option>LE</option><option>LC</option></Select></Field>
            <Field label="Número de documento" required><Input name="dni" required inputMode="numeric" className={`tnum ${af('dni')}`} value={formData.dni} onChange={onChange} placeholder="00000000" /></Field>
            <Field label="Sexo" required><Select name="sexo" required value={formData.sexo} onChange={onChange} className={af('sexo')}><option value="">Seleccionar…</option>{SEXO.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Clase (año)" required><Input name="clase" required inputMode="numeric" maxLength={4} className={`tnum ${af('clase')}`} value={formData.clase} onChange={onChange} placeholder="1990" /></Field>
            <Field label="Fecha de nacimiento" required hint="DD/MM/AAAA"><Input name="fechaNacimiento" required className={`tnum ${af('fechaNacimiento')}`} value={formData.fechaNacimiento} onChange={onChange} placeholder="01/01/1990" /></Field>
            <Field label="Lugar de nacimiento" required><Input name="lugarNacimiento" required value={formData.lugarNacimiento} onChange={onChange} placeholder="Buenos Aires" className={af('lugarNacimiento')} /></Field>
            <Field label="Nacionalidad" required><Input name="nacionalidad" required value={formData.nacionalidad} onChange={onChange} className={af('nacionalidad')} /></Field>
            <Field label="Estado civil" required><Select name="estadoCivil" required value={formData.estadoCivil} onChange={onChange} className={af('estadoCivil')}><option value="">Seleccionar…</option>{ESTCIVIL.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Profesión" required className="sm:col-span-2"><Select name="profesion" required value={formData.profesion} onChange={onChange} className={af('profesion')}><option value="">Seleccionar…</option>{PROFESIONES.map(p => <option key={p}>{p}</option>)}</Select></Field>
          </div>
        </FormSection>

        <FormSection n="3" title="Domicilio" sub="Dirección del afiliado">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Distrito"><Input name="distrito" value={formData.distrito} disabled className="bg-slate-50 text-slate-500" /></Field>
            <Field label="Localidad" required><Select name="localidad" required value={formData.localidad} onChange={onChange} className={af('localidad')}><option value="">Seleccionar…</option>{LOCALIDADES.map(l => <option key={l}>{l}</option>)}</Select></Field>
            <Field label="Calle" required className="sm:col-span-2"><Input name="calle" required value={formData.calle} onChange={onChange} placeholder="Av. del Libertador" className={af('calle')} /></Field>
            <Field label="Número" required><Input name="numero" required inputMode="numeric" className={`tnum ${af('numero')}`} value={formData.numero} onChange={onChange} placeholder="1234" /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Piso"><Input name="piso" value={formData.piso} onChange={onChange} /></Field>
              <Field label="Dpto"><Input name="dpto" value={formData.dpto} onChange={onChange} /></Field>
            </div>
          </div>
        </FormSection>

        <FormSection n="4" title="Contacto" sub="Datos de comunicación">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Celular"><Input name="celular" inputMode="tel" value={formData.celular} onChange={onChange} placeholder="11 5555 5555" className={af('celular')} /></Field>
            <Field label="Email"><Input name="mail" type="email" value={formData.mail} onChange={onChange} placeholder="correo@gmail.com" className={af('mail')} /></Field>
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

// ============================================================================
//  DniUploader — rediseñado con jerarquía clara y panel de ayuda
// ============================================================================

interface DniUploaderProps {
  dni: FichaFormProps['dni'];
  onIniciarSesionDidit?: () => void;
  iniciandoSesionDidit?: boolean;
  diditLoading?: boolean;
  diditError?: string | null;
  diditMensajePendiente?: string | null;
  publicLink?: string | null;
  creandoPublicLink?: boolean;
  onCrearPublicLink?: () => void;
}

function DniUploader({
  dni, onIniciarSesionDidit, iniciandoSesionDidit,
  diditLoading, diditError, diditMensajePendiente,
  publicLink, creandoPublicLink, onCrearPublicLink,
}: DniUploaderProps) {
  const archivoInputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const copiarLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* sin clipboard API: el input ya está seleccionable */
    }
  };

  const linkWhatsApp = publicLink
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hola, te paso el link para cargar tu DNI en SIA (vence en 24 hs, un solo uso): ${publicLink}`
      )}`
    : '#';

  return (
    <div>
      {/* HEADER · pregunta + botón ayuda ------------------------------- */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900">¿Cómo cargás el DNI?</h4>
          <p className="text-xs text-slate-500 mt-0.5">Elegí la opción que más te convenga</p>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(o => !o)}
          aria-expanded={helpOpen}
          aria-controls="dni-help-panel"
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 transition
            ${helpOpen
              ? 'bg-brand-50 text-brand-700 ring-brand-200'
              : 'text-slate-600 bg-white hover:bg-slate-50 ring-slate-200'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
          </svg>
          <span>{helpOpen ? 'Cerrar' : '¿Qué hace cada uno?'}</span>
        </button>
      </div>

      {/* PANEL DE AYUDA (colapsable) ------------------------------------ */}
      {helpOpen && (
        <div id="dni-help-panel" className="mb-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Las formas de cargar el DNI</p>

          {onIniciarSesionDidit && (
            <HelpItem
              tint="emerald"
              icon={<DniCameraIcon className="w-5 h-5" />}
              title="Escanear automáticamente"
              badge="Online"
              text="La forma más rápida. Saca las fotos del DNI y completa los datos del afiliado por vos. Necesita internet."
            />
          )}
          <HelpItem
            tint="brand"
            icon={<BarcodeIcon className="w-5 h-5" />}
            title="Frente y dorso seguidos"
            badge="Sin internet"
            text="Te guía paso a paso: primero el frente, después el dorso. Si el código del DNI se ve bien, lee los datos automáticamente."
          />
          <HelpItem
            tint="slate"
            icon={<Icon name="upload" className="w-5 h-5" />}
            title="Subir un archivo"
            badge="Sin internet"
            text="Si ya tenés el DNI como foto o PDF guardado en el teléfono. Acepta PDF, JPG o PNG."
          />
          <HelpItem
            tint="slate"
            icon={<ImageIcon className="w-5 h-5" />}
            title="Cada cara por separado"
            badge="Sin internet"
            text="Si tenés el frente y el dorso como dos imágenes distintas, o querés cargar una con cámara y la otra desde la galería."
          />
          {onCrearPublicLink && (
            <HelpItem
              tint="slate"
              icon={<LinkIcon className="w-5 h-5" />}
              title="Compartir link público"
              badge="Online"
              text="Si el afiliado no está con vos. Generás un link para que él mismo cargue su DNI desde el celular. Vence en 24 horas."
            />
          )}

          <div className="pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setHelpOpen(false)} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
              Entendido, cerrar
            </button>
          </div>
        </div>
      )}

      {/* OPCIÓN PRIMARIA · ONLINE (Didit) ------------------------------- */}
      {onIniciarSesionDidit && (
        <button
          type="button"
          onClick={onIniciarSesionDidit}
          disabled={iniciandoSesionDidit || diditLoading}
          className="w-full p-4 rounded-xl bg-emerald-600 text-white text-left hover:bg-emerald-700 active:bg-emerald-800 transition shadow-sm flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            {iniciandoSesionDidit
              ? <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              : <DniCameraIcon className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">
                {iniciandoSesionDidit ? 'Iniciando escaneo…' : 'Escanear automáticamente'}
              </span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Online</span>
            </div>
            <p className="text-[12px] text-emerald-50/90 mt-0.5 leading-snug">Completa los datos del DNI por vos</p>
          </div>
          <Icon name="chevronR" className="w-5 h-5 text-white/80 shrink-0" strokeWidth={2} />
        </button>
      )}

      {/* Mensajes de estado de Didit ------------------------------------ */}
      {diditLoading && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-emerald-300 border-t-emerald-600 animate-spin shrink-0 mt-0.5" />
          <span className="text-sm text-emerald-800 font-medium">Completá el escaneo en la ventana de Didit. Los datos aparecerán automáticamente cuando termine.</span>
        </div>
      )}
      {diditError && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{diditError}</div>
      )}
      {diditMensajePendiente && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">{diditMensajePendiente}</div>
      )}

      {/* SEPARADOR ------------------------------------------------------ */}
      {onIniciarSesionDidit && (
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">o sin internet</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      )}

      {/* OPCIONES SECUNDARIAS · OFFLINE --------------------------------- */}
      <div className="space-y-2">
        {dni.onScanDniData && (
          <button
            type="button"
            onClick={dni.onScanDniData}
            className="w-full p-3 rounded-xl bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 hover:ring-slate-300 transition flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900">Frente y dorso seguidos</div>
              <p className="text-[12px] mt-0.5 text-slate-500">Lee el código del DNI</p>
            </div>
            <Icon name="chevronR" className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2} />
          </button>
        )}

        <button
          type="button"
          onClick={() => archivoInputRef.current?.click()}
          disabled={dni.procesandoArchivo}
          className="w-full p-3 rounded-xl bg-white ring-1 ring-slate-200 text-slate-800 hover:bg-slate-50 hover:ring-slate-300 transition flex items-center gap-3 text-left disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Icon name="upload" className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900">Subir un archivo</div>
            <p className="text-[12px] mt-0.5 text-slate-500">PDF, JPG o PNG ya guardado</p>
          </div>
          <Icon name="chevronR" className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2} />
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
      </div>

      {/* SUBI CADA CARA POR SEPARADO ------------------------------------ */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">O subí cada cara por separado</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DniSlot label="Frente" ok={dni.frenteOk} preview={dni.fotoFrente} onClick={dni.onScanFrente} />
          <DniSlot label="Dorso" ok={dni.dorsoOk} preview={dni.fotoDorso} onClick={dni.onScanDorso} />
        </div>
      </div>

      {/* Estados de archivo --------------------------------------------- */}
      {dni.procesandoArchivo && <p className="text-xs text-slate-500 font-medium mt-3">Procesando archivo del DNI…</p>}
      {(dni.frenteOk || dni.dorsoOk) && (
        <p className="text-xs text-emerald-600 font-medium mt-3 flex items-center gap-1.5">
          <Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Documento adjuntado
        </p>
      )}
      {dni.onScanBarcode && (dni.frenteOk || dni.dorsoOk) && (
        <button
          type="button"
          onClick={dni.onScanBarcode}
          className="mt-3 w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:bg-slate-950 transition flex items-center justify-center gap-2"
        >
          <BarcodeIcon className="w-5 h-5" /> Reintentar lectura del código
        </button>
      )}

      {/* BLOQUE DELEGAR · link público compartible ---------------------- */}
      {onCrearPublicLink && (
        <div className="mt-6 pt-5 border-t border-dashed border-slate-200">
          {!publicLink ? (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900/5 text-slate-700 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900">¿El afiliado no está con vos?</div>
                  <p className="text-[12px] mt-0.5 text-slate-500">Generá un link para que cargue el DNI desde su celular.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCrearPublicLink}
                disabled={creandoPublicLink}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 active:bg-slate-950 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creandoPublicLink
                  ? <><span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Generando link…</>
                  : <><LinkIcon className="w-4 h-4" /> Generar link de carga pública</>}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-400">Válido por 24 horas · un solo uso</p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Icon name="check" className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-900">Link generado</div>
                  <p className="text-[12px] mt-0.5 text-slate-500">Compartilo con el afiliado · vence en 24 hs</p>
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-3">
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={publicLink}
                    onFocus={e => e.currentTarget.select()}
                    className="flex-1 bg-transparent text-xs text-slate-100 outline-none font-mono min-w-0"
                  />
                  <button
                    type="button"
                    onClick={copiarLink}
                    className="shrink-0 rounded-md bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 text-xs font-semibold transition flex items-center gap-1"
                  >
                    {copiado
                      ? <><Icon name="check" className="w-3.5 h-3.5" strokeWidth={2.5} /> Copiado</>
                      : <><CopyIcon className="w-3.5 h-3.5" /> Copiar</>}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={linkWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <WhatsAppIcon className="w-4 h-4" /> WhatsApp
                </a>
                <button
                  type="button"
                  onClick={onCrearPublicLink}
                  disabled={creandoPublicLink}
                  className="py-2 rounded-lg bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-60"
                >
                  {creandoPublicLink ? 'Generando…' : 'Generar otro'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  Subcomponentes
// ============================================================================

function HelpItem({ tint, icon, title, badge, text }:
  { tint: 'emerald' | 'brand' | 'slate'; icon: React.ReactNode; title: string; badge: string; text: string }) {
  const tints = {
    emerald: { box: 'bg-emerald-100 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
    brand:   { box: 'bg-brand-50 text-brand-700',      badge: 'bg-slate-100 text-slate-700' },
    slate:   { box: 'bg-slate-100 text-slate-700',     badge: 'bg-slate-100 text-slate-700' },
  }[tint];
  return (
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tints.box}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-900">{title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tints.badge}`}>{badge}</span>
        </div>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function DniSlot({ label, ok, preview, onClick }:
  { label: string; ok: boolean; preview?: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-[1.58] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition
        ${preview ? '[&>svg]:opacity-0 [&>span]:opacity-0' : ''}
        ${ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/40'}`}
    >
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
  return (
    <div className="mt-3 flex items-start gap-2 text-xs text-amber-700">
      <span className="text-base leading-none mt-px">⚠</span>
      <span>No se pudo leer el código del DNI. Cargá los datos manualmente abajo.</span>
    </div>
  );
}

// ============================================================================
//  Icons inline (no agregamos al set global para mantener este archivo autosuficiente)
// ============================================================================

function BarcodeIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3.75 5.25v13.5M6.75 5.25v13.5M9.75 5.25v13.5M13.5 5.25v13.5M16.5 5.25v13.5M20.25 5.25v13.5" />
    </svg>
  );
}

function DniCameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  );
}

function ImageIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Z" />
    </svg>
  );
}

function LinkIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function CopyIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
    </svg>
  );
}

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}
