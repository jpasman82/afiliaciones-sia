'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';
import { FichaForm } from '../../components/ficha/FichaForm';
import { EscanerCodigoBarras } from '../../components/ficha/EscanerCodigoBarras';
import { decodeDniBarcode } from '../../lib/decodeDniBarcode';
import { parsedDniToFormFields } from '../../lib/parseDniPdf417';
import { useDiditSession } from '../../../hooks/useDiditSession';

const DNI_PUBLIC_MAX_WIDTH = 1800;
const DNI_PUBLIC_JPEG_QUALITY = 0.87;

type LinkPublico = {
  afiliadorUid: string;
  afiliadorEmail: string;
  afiliadorNombre?: string;
};

const fichaInicial = {
  tipoDocumento: 'DNI',
  dni: '',
  apellidos: '',
  nombres: '',
  sexo: '',
  clase: '',
  fechaNacimiento: '',
  lugarNacimiento: '',
  nacionalidad: 'Argentina',
  profesion: '',
  estadoCivil: '',
  celular: '',
  mail: '',
  distrito: 'Buenos Aires',
  calle: '',
  numero: '',
  piso: '',
  dpto: '',
  localidad: '',
  observaciones: '',
  estadoControl: 'pendiente',
};

type FichaPublicaData = typeof fichaInicial;
type RecortePublico = {
  cara: 'frente' | 'dorso';
  imagen: string;
  siguienteImagen?: string;
};

export default function CargaPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const frenteInputRef = useRef<HTMLInputElement>(null);
  const dorsoInputRef = useRef<HTMLInputElement>(null);

  const [link, setLink] = useState<LinkPublico | null>(null);
  const [validando, setValidando] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [formData, setFormData] = useState<FichaPublicaData>({ ...fichaInicial });
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [decodeStatus, setDecodeStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const dniDatosLeidosRef = useRef(false);
  const [recortePendiente, setRecortePendiente] = useState<RecortePublico | null>(null);
  const [escaneandoCodigo, setEscaneandoCodigo] = useState(false);

  const {
    iniciandoSesionDidit,
    diditProcesandoRetorno,
    diditError,
    diditMensajePendiente,
    diditAutocompleted,
    diditCamposAutocompletados,
    diditFrenteStorageUrl,
    diditDorsoStorageUrl,
    diditDniImageUrl,
    diditDniImagePath,
    iniciarSesion: iniciarSesionDidit,
  } = useDiditSession({
    startSessionUrl: `/api/link-publico/${token ?? ''}/iniciar-sesion-didit`,
    pollStatusUrl: `/api/link-publico/${token ?? ''}/estado-didit`,
    storageKey: `didit_session_pendiente:publico:${token ?? ''}`,
    getStartHeaders: async () => ({ 'Content-Type': 'application/json' }),
    getStartBody: async () => ({}),
    setFormData,
  });

  useEffect(() => {
    const validar = async () => {
      if (!token) return;
      setValidando(true);
      setError('');
      try {
        const r = await fetch(`/api/link-publico/${token}`);
        if (!r.ok) {
          setError('Este link no existe, ya fue usado o está vencido.');
          return;
        }
        const data = await r.json();
        setLink(data as LinkPublico);
      } catch {
        setError('No se pudo validar el link. Puede estar vencido o ya usado.');
      } finally {
        setValidando(false);
      }
    };
    validar();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const normalizarFichaPayload = (data: FichaPublicaData) => ({
    tipoDocumento: data.tipoDocumento || 'DNI',
    dni: String(data.dni || '').replace(/\D/g, ''),
    apellidos: data.apellidos || '',
    nombres: data.nombres || '',
    sexo: data.sexo || '',
    clase: data.clase || '',
    fechaNacimiento: data.fechaNacimiento || '',
    lugarNacimiento: data.lugarNacimiento || '',
    nacionalidad: data.nacionalidad || 'Argentina',
    profesion: data.profesion || '',
    estadoCivil: data.estadoCivil || '',
    celular: data.celular || '',
    mail: data.mail || '',
    distrito: data.distrito || 'Buenos Aires',
    calle: data.calle || '',
    numero: data.numero || '',
    piso: data.piso || '',
    dpto: data.dpto || '',
    localidad: data.localidad || '',
    observaciones: data.observaciones || '',
    estadoControl: data.estadoControl || 'pendiente',
  });

  const prepararImagenArchivo = async (file: File): Promise<string> => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        image.src = url;
      });
      const scale = img.width > DNI_PUBLIC_MAX_WIDTH ? DNI_PUBLIC_MAX_WIDTH / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar la imagen.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const renderizarPdf = async (file: File): Promise<string[]> => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const paginas: string[] = [];
    try {
      for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
        const page = await pdf.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, 2200 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo preparar una pagina del PDF.');
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        paginas.push(canvas.toDataURL('image/jpeg', 0.9));
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }
    } finally {
      const destroy = (pdf as { destroy?: () => Promise<void> }).destroy;
      if (destroy) await destroy.call(pdf);
    }
    return paginas;
  };

  const intentarLeerDni = async (dataUrl: string, cara: 'frente' | 'dorso') => {
    if (dniDatosLeidosRef.current) return;
    setDecodeStatus(prev => prev === 'success' ? 'success' : 'processing');
    try {
      const parsed = await decodeDniBarcode(dataUrl);
      if (parsed && (parsed.dni || parsed.apellidos)) {
        setFormData(prev => ({ ...prev, ...parsedDniToFormFields(parsed) }));
        dniDatosLeidosRef.current = true;
        setDecodeStatus('success');
      } else {
        setDecodeStatus(cara === 'frente' ? 'idle' : 'failed');
      }
    } catch {
      setDecodeStatus(cara === 'frente' ? 'idle' : 'failed');
    }
  };

  const cargarCara = async (file: File, cara: 'frente' | 'dorso') => {
    setProcesandoArchivo(true);
    try {
      const dataUrl = await prepararImagenArchivo(file);
      setRecortePendiente({ cara, imagen: dataUrl });
    } catch (e: any) {
      alert(e?.message || 'No se pudo procesar la imagen.');
    } finally {
      setProcesandoArchivo(false);
    }
  };

  const aplicarRecorte = async (dataUrl: string) => {
    const recorte = recortePendiente;
    if (!recorte) return;
    if (recorte.cara === 'frente') setFotoFrenteB64(dataUrl);
    else setFotoDorsoB64(dataUrl);

    if (recorte.cara === 'frente' && recorte.siguienteImagen) {
      setRecortePendiente({ cara: 'dorso', imagen: recorte.siguienteImagen });
    } else {
      setRecortePendiente(null);
    }
    await intentarLeerDni(dataUrl, recorte.cara);
  };

  const cargarArchivoUnico = async (file: File) => {
    setProcesandoArchivo(true);
    try {
      let paginas: string[];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        paginas = await renderizarPdf(file);
      } else if (file.type.startsWith('image/')) {
        const img = await prepararImagenArchivo(file);
        paginas = [img];
      } else {
        alert('Subi una imagen JPG/PNG o un PDF del DNI.');
        return;
      }
      if (!paginas.length) throw new Error('El archivo no tiene paginas para procesar.');
      const frente = paginas[0];
      const dorso = paginas[1] || paginas[0];
      setRecortePendiente({ cara: 'frente', imagen: frente, siguienteImagen: dorso });
    } catch (e: any) {
      alert(e?.message || 'No se pudo procesar el archivo.');
    } finally {
      setProcesandoArchivo(false);
    }
  };

  const procesarDNIUnicoImagen = async (): Promise<Blob> => {
    const getImgObj = (b64: string): Promise<HTMLImageElement> => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = b64;
    });
    const imgF = await getImgObj(fotoFrenteB64!);
    const imgD = await getImgObj(fotoDorsoB64!);
    const targetWidth = 1200;
    const scaleF = targetWidth / imgF.width;
    const targetHeightF = imgF.height * scaleF;
    const scaleD = targetWidth / imgD.width;
    const targetHeightD = imgD.height * scaleD;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeightF + targetHeightD + 20;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgF, 0, 0, targetWidth, targetHeightF);
      ctx.drawImage(imgD, 0, targetHeightF + 20, targetWidth, targetHeightD);
    }
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('No se pudo preparar el DNI.'));
      }, 'image/jpeg', DNI_PUBLIC_JPEG_QUALITY);
    });
  };

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !link) return;
    const dni = String(formData.dni || '').replace(/\D/g, '');
    if (!dni) {
      alert('Ingresá un DNI válido.');
      return;
    }
    if (!diditDniImagePath && (!fotoFrenteB64 || !fotoDorsoB64)) {
      alert('Cargá frente y dorso del DNI antes de enviar.');
      return;
    }
    setSubiendo(true);
    let paso = 'preparar imagen';
    try {
      let ruta: string;
      if (diditDniImagePath) {
        // Imagen combinada frente+dorso ya subida por el webhook de Didit. No re-subir.
        ruta = diditDniImagePath;
      } else {
        const blob = await procesarDNIUnicoImagen();
        ruta = `dnisPublicos/${token}/${dni}-${Date.now()}.jpg`;
        paso = 'subir DNI';
        await uploadBytes(ref(storage, ruta), blob, { contentType: 'image/jpeg' });
      }

      paso = 'guardar ficha';
      const fichaRef = doc(collection(db, 'afiliaciones'));
      const indiceRef = doc(db, 'dniIndex', dni);
      const linkRef = doc(db, 'linksCargaPublica', token);
      const payload = {
        ...normalizarFichaPayload(formData),
        dni,
        archivoDniPath: ruta,
        afiliadorUid: link.afiliadorUid,
        afiliadorEmail: link.afiliadorEmail || '',
        afiliadorNombre: link.afiliadorNombre || '',
        origen: 'link_publico',
        linkToken: token,
        fecha: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(indiceRef, {
        dni,
        fichaId: fichaRef.id,
        afiliadorUid: link.afiliadorUid,
        fecha: serverTimestamp(),
      });
      batch.set(fichaRef, payload);
      batch.update(linkRef, {
        usado: true,
        usadoEn: serverTimestamp(),
        fichaId: fichaRef.id,
        dni,
      });
      await batch.commit();
      setEnviado(true);
    } catch (e: any) {
      console.error('Error al guardar ficha publica:', e);
      alert(`No se pudo enviar la ficha (${paso}). ${e?.message || 'El link puede estar vencido, usado o el DNI ya cargado.'}`);
    } finally {
      setSubiendo(false);
    }
  };

  if (validando) {
    return <PublicShell><p className="text-sm text-slate-500">Validando link...</p></PublicShell>;
  }

  if (error || !link) {
    return <PublicShell><p className="text-sm font-semibold text-red-600">{error || 'Link no disponible.'}</p></PublicShell>;
  }

  if (enviado) {
    return (
      <PublicShell>
        <div className="rounded-2xl bg-white p-6 shadow-pop ring-1 ring-slate-200 text-center">
          <h1 className="text-xl font-bold text-slate-900">Ficha enviada correctamente</h1>
          <p className="mt-2 text-sm text-slate-500">Gracias. El afiliador ya tiene la ficha en su registro.</p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      {recortePendiente && (
        <RecortadorDniPublico
          key={`${recortePendiente.cara}-${recortePendiente.imagen.slice(0, 32)}`}
          cara={recortePendiente.cara}
          imagen={recortePendiente.imagen}
          onClose={() => setRecortePendiente(null)}
          onApply={aplicarRecorte}
        />
      )}
      {escaneandoCodigo && (
        <EscanerCodigoBarras
          fotoFrente={fotoFrenteB64}
          fotoDorso={fotoDorsoB64}
          onClose={() => setEscaneandoCodigo(false)}
          onApply={(campos) => {
            setFormData(prev => ({ ...prev, ...campos }));
            dniDatosLeidosRef.current = true;
            setDecodeStatus('success');
            setEscaneandoCodigo(false);
          }}
        />
      )}
      <input
        ref={frenteInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) cargarCara(file, 'frente');
        }}
      />
      <input
        ref={dorsoInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) cargarCara(file, 'dorso');
        }}
      />
      <FichaForm
        formData={formData}
        onChange={handleChange}
        onSubmit={guardarFicha}
        onCancel={() => setFormData({ ...fichaInicial })}
        editando={false}
        subiendo={subiendo}
        hideBackButton
        hideCancelButton
        submitLabel="Enviar ficha"
        dni={{
          modo: 'escaner',
          setModo: () => {},
          frenteOk: !!(fotoFrenteB64 || diditFrenteStorageUrl || diditDniImageUrl),
          dorsoOk: !!(fotoDorsoB64 || diditDorsoStorageUrl || diditDniImageUrl),
          fotoFrente: fotoFrenteB64 || diditFrenteStorageUrl || diditDniImageUrl,
          fotoDorso: fotoDorsoB64 || diditDorsoStorageUrl || diditDniImageUrl,
          procesandoArchivo,
          onScanFrente: () => frenteInputRef.current?.click(),
          onScanDorso: () => dorsoInputRef.current?.click(),
          onPickFile: cargarArchivoUnico,
          onScanBarcode: () => setEscaneandoCodigo(true),
        }}
        decodeStatus={decodeStatus}
        diditLoading={diditProcesandoRetorno}
        diditError={diditError}
        diditMensajePendiente={diditMensajePendiente}
        diditAutocompleted={diditAutocompleted}
        diditCamposAutocompletados={diditCamposAutocompletados}
        onIniciarSesionDidit={iniciarSesionDidit}
        iniciandoSesionDidit={iniciandoSesionDidit}
      />
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Carga publica</p>
          <h1 className="text-2xl font-bold text-slate-900">Ficha de afiliacion</h1>
        </div>
        {children}
      </div>
    </main>
  );
}

type CropBox = { x: number; y: number; w: number; h: number };

function RecortadorDniPublico({
  cara,
  imagen,
  onClose,
  onApply,
}: {
  cara: 'frente' | 'dorso';
  imagen: string;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [displayed, setDisplayed] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const dragInfo = useRef<{ px: number; py: number; box: CropBox } | null>(null);

  const recalcular = () => {
    const img = imgRef.current;
    const wrap = wrapperRef.current;
    if (!img || !wrap || !img.naturalWidth) return;

    const rect = wrap.getBoundingClientRect();
    const aspect = img.naturalWidth / img.naturalHeight;
    let w: number;
    let h: number;
    if (rect.width / aspect <= rect.height) {
      w = rect.width;
      h = rect.width / aspect;
    } else {
      h = rect.height;
      w = rect.height * aspect;
    }

    const cropAspect = 1.58;
    let cropW = w * 0.92;
    let cropH = cropW / cropAspect;
    if (cropH > h * 0.92) {
      cropH = h * 0.92;
      cropW = cropH * cropAspect;
    }
    setDisplayed({ w, h });
    setBox({ x: (w - cropW) / 2, y: (h - cropH) / 2, w: cropW, h: cropH });
  };

  useEffect(() => {
    const onResize = () => recalcular();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const mover = (e: React.PointerEvent) => {
    if (!displayed) return;
    e.preventDefault();
    dragInfo.current = { px: e.clientX, py: e.clientY, box: { ...box } };
    const onMove = (ev: PointerEvent) => {
      if (!dragInfo.current || !displayed) return;
      ev.preventDefault();
      const dx = ev.clientX - dragInfo.current.px;
      const dy = ev.clientY - dragInfo.current.py;
      const start = dragInfo.current.box;
      setBox({
        ...start,
        x: clamp(start.x + dx, 0, displayed.w - start.w),
        y: clamp(start.y + dy, 0, displayed.h - start.h),
      });
    };
    const onUp = () => {
      dragInfo.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const ajustar = (delta: number) => {
    if (!displayed) return;
    const aspect = 1.58;
    const nextW = clamp(box.w + delta, 140, displayed.w);
    const nextH = nextW / aspect;
    if (nextH > displayed.h) return;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    setBox({
      x: clamp(cx - nextW / 2, 0, displayed.w - nextW),
      y: clamp(cy - nextH / 2, 0, displayed.h - nextH),
      w: nextW,
      h: nextH,
    });
  };

  const usar = () => {
    const img = imgRef.current;
    if (!img || !displayed) return;
    const scaleX = img.naturalWidth / displayed.w;
    const scaleY = img.naturalHeight / displayed.h;
    const sx = box.x * scaleX;
    const sy = box.y * scaleY;
    const sw = box.w * scaleX;
    const sh = box.h * scaleY;
    const outputScale = sw > DNI_PUBLIC_MAX_WIDTH ? DNI_PUBLIC_MAX_WIDTH / sw : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * outputScale);
    canvas.height = Math.round(sh * outputScale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', DNI_PUBLIC_JPEG_QUALITY);
    canvas.width = 0;
    canvas.height = 0;
    onApply(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center shrink-0">
        <div>
          <h3 className="font-bold text-lg">Recortar {cara} del DNI</h3>
          <p className="text-xs text-white/60 mt-0.5">Mové el marco hasta cubrir el DNI.</p>
        </div>
        <button type="button" onClick={onClose} className="text-white font-bold px-3 py-1 bg-red-600 rounded">Cerrar</button>
      </div>

      <div ref={wrapperRef} className="flex-1 relative bg-black flex items-center justify-center min-h-0 overflow-hidden p-3">
        <div className="relative touch-none select-none" style={displayed ? { width: displayed.w, height: displayed.h } : { width: 1, height: 1, opacity: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={imagen} alt={`DNI ${cara}`} onLoad={recalcular} draggable={false} className="block w-full h-full pointer-events-none" />
          {displayed && (
            <div
              className="absolute border-4 border-emerald-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] cursor-move"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h, touchAction: 'none' }}
              onPointerDown={mover}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded bg-black/45 text-white/85 text-xs font-bold uppercase tracking-wide pointer-events-none">
                {cara}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-black p-3 md:p-4 shrink-0">
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => ajustar(-40)} className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold text-sm active:bg-slate-700">
            Achicar marco
          </button>
          <button type="button" onClick={() => ajustar(40)} className="flex-1 py-3 rounded-lg bg-slate-800 text-white font-bold text-sm active:bg-slate-700">
            Agrandar marco
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-white text-slate-900 font-bold text-sm active:bg-slate-100">
            Cancelar
          </button>
          <button type="button" onClick={usar} className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm active:bg-emerald-700">
            Usar recorte
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
