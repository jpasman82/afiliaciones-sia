'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../../firebaseConfig';
import { FichaForm } from '../../components/ficha/FichaForm';
import { decodeDniBarcode } from '../../lib/decodeDniBarcode';
import { parsedDniToFormFields } from '../../lib/parseDniPdf417';

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
  nacionalidad: '',
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
  const [dniDatosLeidos, setDniDatosLeidos] = useState(false);

  useEffect(() => {
    const validar = async () => {
      if (!token) return;
      setValidando(true);
      setError('');
      try {
        const snap = await getDoc(doc(db, 'linksCargaPublica', token));
        if (!snap.exists()) {
          setError('Este link no existe, ya fue usado o esta vencido.');
          return;
        }
        setLink(snap.data() as LinkPublico);
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
    nacionalidad: data.nacionalidad || '',
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
    if (dniDatosLeidos) return;
    setDecodeStatus(prev => prev === 'success' ? 'success' : 'processing');
    try {
      const parsed = await decodeDniBarcode(dataUrl);
      if (parsed && (parsed.dni || parsed.apellidos)) {
        setFormData(prev => ({ ...prev, ...parsedDniToFormFields(parsed) }));
        setDniDatosLeidos(true);
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
      if (cara === 'frente') setFotoFrenteB64(dataUrl);
      else setFotoDorsoB64(dataUrl);
      await intentarLeerDni(dataUrl, cara);
    } catch (e: any) {
      alert(e?.message || 'No se pudo procesar la imagen.');
    } finally {
      setProcesandoArchivo(false);
    }
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
      setFotoFrenteB64(frente);
      setFotoDorsoB64(dorso);
      await intentarLeerDni(frente, 'frente');
      await intentarLeerDni(dorso, 'dorso');
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
    if (!fotoFrenteB64 || !fotoDorsoB64) {
      alert('Cargá frente y dorso del DNI antes de enviar.');
      return;
    }
    setSubiendo(true);
    try {
      const blob = await procesarDNIUnicoImagen();
      const ruta = `dnisPublicos/${token}/${dni}-${Date.now()}.jpg`;
      await uploadBytes(ref(storage, ruta), blob, { contentType: 'image/jpeg' });

      const fichaRef = doc(collection(db, 'afiliaciones'));
      const indiceRef = doc(db, 'dniIndex', dni);
      const linkRef = doc(db, 'linksCargaPublica', token);
      const payload = {
        ...normalizarFichaPayload(formData),
        dni,
        archivoDniPath: ruta,
        afiliadorUid: link.afiliadorUid,
        afiliadorEmail: link.afiliadorEmail,
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
      alert('No se pudo enviar la ficha. El link puede estar vencido, usado o el DNI ya cargado.');
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
      <input
        ref={frenteInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
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
        dni={{
          modo: 'escaner',
          setModo: () => {},
          frenteOk: !!fotoFrenteB64,
          dorsoOk: !!fotoDorsoB64,
          fotoFrente: fotoFrenteB64,
          fotoDorso: fotoDorsoB64,
          procesandoArchivo,
          onScanFrente: () => frenteInputRef.current?.click(),
          onScanDorso: () => dorsoInputRef.current?.click(),
          onPickFile: cargarArchivoUnico,
        }}
        decodeStatus={decodeStatus}
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
