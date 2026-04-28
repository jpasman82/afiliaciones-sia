'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';

const IconNueva = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const IconFichas = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const IconUsuarios = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;
const IconPC = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" /></svg>;

const EscanerDocumento = ({ onClose, onCapture, titulo, tipo = 'dni' }: { onClose: () => void, onCapture: (imgData: string) => void, titulo: string, tipo?: 'dni' | 'ficha' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const proporcionMarco = tipo === 'ficha' ? 'aspect-[1.85]' : 'aspect-[1.58]';

  useEffect(() => {
    let currentStream: MediaStream;
    const encenderCamara = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        currentStream = stream;
      } catch (err) {
        alert("Verifica los permisos de tu navegador.");
        onClose();
      }
    };
    encenderCamara();
    return () => { if (currentStream) currentStream.getTracks().forEach(t => t.stop()); };
  }, [onClose]);

  const tomarFoto = () => {
    const video = videoRef.current;
    const marco = marcoRef.current;
    if (!video || !marco) return;

    const canvas = document.createElement('canvas');
    const videoRect = video.getBoundingClientRect();
    const marcoRect = marco.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const margenX = marcoRect.width * 0.05;
    const margenY = marcoRect.height * 0.05;

    const sx = Math.max(0, (marcoRect.left - videoRect.left - margenX) * scaleX);
    const sy = Math.max(0, (marcoRect.top - videoRect.top - margenY) * scaleY);
    const sWidth = Math.min(video.videoWidth - sx, (marcoRect.width + margenX * 2) * scaleX);
    const sHeight = Math.min(video.videoHeight - sy, (marcoRect.height + margenY * 2) * scaleY);

    canvas.width = sWidth;
    canvas.height = sHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (tipo === 'ficha') {
        ctx.filter = 'contrast(1.5) grayscale(100%)';
      } else {
        ctx.filter = 'contrast(1.1)';
      }
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPreview(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10">
        <h3 className="font-bold text-lg">{titulo}</h3>
        <button onClick={onClose} className="text-white font-bold px-3 py-1 bg-red-600 rounded">Cerrar</button>
      </div>
      
      <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${preview ? 'hidden' : ''}`}>
        <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        <div ref={marcoRef} className={`relative w-[90%] ${proporcionMarco} border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none`}>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
        </div>
      </div>
      
      {!preview && (
        <div className="h-32 bg-black flex items-center justify-center pb-8 z-10">
          <button onClick={tomarFoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 active:bg-gray-200 transition shadow-[0_0_15px_rgba(255,255,255,0.5)]"></button>
        </div>
      )}

      {preview && (
        <div className="flex-1 flex flex-col bg-black">
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={preview} alt="Vista previa" className="max-w-full max-h-full rounded-xl border-2 border-gray-500 shadow-2xl" />
          </div>
          <div className="h-32 bg-black flex items-center justify-center gap-4 pb-8 z-10 px-4">
            <button onClick={() => setPreview(null)} className="flex-1 py-4 bg-gray-800 text-white font-black uppercase tracking-wide rounded-xl active:bg-gray-700 transition">
              Reintentar
            </button>
            <button onClick={() => onCapture(preview)} className="flex-1 py-4 bg-green-600 text-white font-black uppercase tracking-wide rounded-xl active:bg-green-500 transition">
              Usar Foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { user, loading, role, isAdmin, loginConGoogle, logout } = useAuth();
  
  const [tab, setTab] = useState<'nueva' | 'registros' | 'control' | 'usuarios' | 'detalle' | 'editar'>('registros');
  
  const [formData, setFormData] = useState({
    tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', 
    sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', 
    nacionalidad: '', profesion: '', estadoCivil: '', 
    celular: '', mail: '',
    distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: '', estado: 'pendiente', comentarioError: '', subidoPor: '', aprobadoPor: ''
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<any>(null);
  
  const [modoArchivo, setModoArchivo] = useState<'escaner' | 'unico'>('escaner');
  const [camaraActiva, setCamaraActiva] = useState<null | 'frente' | 'dorso' | 'ficha' | 'fichaExtra'>(null);
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [fotoFichaB64, setFotoFichaB64] = useState<string | null>(null);
  const [archivoUnico, setArchivoUnico] = useState<File | null>(null);
  
  const [subiendo, setSubiendo] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState(false);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroAfiliador, setFiltroAfiliador] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todas');

  useEffect(() => {
    if (typeof window !== "undefined" && !window.history.state) {
      window.history.replaceState({ tab: 'registros' }, '', '');
    }
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setTab(e.state.tab);
      } else {
        setTab('registros');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const cambiarTab = (nuevoTab: 'nueva' | 'registros' | 'control' | 'usuarios' | 'detalle' | 'editar') => {
    setTab(nuevoTab);
    window.history.pushState({ tab: nuevoTab }, '', '');
  };

  useEffect(() => {
    if (!user || role === 'pendiente') return;
    const q = isAdmin 
      ? query(collection(db, 'afiliaciones'), orderBy('fecha', 'desc'))
      : query(collection(db, 'afiliaciones'), where('afiliadorUid', '==', (user as any).uid));
    return onSnapshot(q, (snapshot) => setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [user, isAdmin, role]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'usuarios'), orderBy('fechaRegistro', 'desc'));
    return onSnapshot(q, (snapshot) => setUsuariosSistema(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [isAdmin]);

  const registrosFiltrados = registros.filter((reg) => {
    if (isAdmin && filtroAfiliador !== 'todas' && reg.afiliadorUid !== filtroAfiliador) return false;
    if (filtroEstado !== 'todas' && reg.estado !== filtroEstado) return false;
    if (busqueda.trim() !== '') {
      const b = busqueda.toLowerCase().trim();
      const coincideDni = reg.dni?.toLowerCase().includes(b);
      const coincideNombres = reg.nombres?.toLowerCase().includes(b);
      const coincideApellidos = reg.apellidos?.toLowerCase().includes(b);
      if (!coincideDni && !coincideNombres && !coincideApellidos) return false;
    }
    return true;
  });

  const cambiarEstado = async (id: string, nuevoEstado: string, comentarioError: string = '') => {
    try {
      const payload: any = { estado: nuevoEstado, comentarioError };
      if (nuevoEstado === 'subida') payload.subidoPor = (user as any).displayName || (user as any).email;
      if (nuevoEstado === 'aprobada') payload.aprobadoPor = (user as any).displayName || (user as any).email;
      await updateDoc(doc(db, 'afiliaciones', id), payload);
    } catch (e) {
      alert('Error de red.');
    }
  };

  const adjuntarFichaFisica = async (id: string, dni: string, fichaB64: string) => {
    setSubiendo(true);
    try {
      const res = await fetch(fichaB64);
      const blob = await res.blob();
      const ruta = `fichas/${dni}-${Date.now()}.jpg`;
      const storageRef = ref(storage, ruta);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const urlFicha = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'afiliaciones', id), { archivoFicha: urlFicha });
    } catch (error) {
      alert('Error al subir la ficha.');
    } finally {
      setSubiendo(false);
    }
  };

  const descargarZip = async (tipo: 'dni' | 'ficha') => {
    const conArchivo = registrosFiltrados.filter(r => tipo === 'dni' ? r.archivoDni : r.archivoFicha);
    if (conArchivo.length === 0) return;
    setDescargandoZip(true);
    const zip = new JSZip();
    const CONCURRENCIA = 10;
    for (let i = 0; i < conArchivo.length; i += CONCURRENCIA) {
      const lote = conArchivo.slice(i, i + CONCURRENCIA);
      await Promise.all(lote.map(async (reg) => {
        try {
          const targetUrl = tipo === 'dni' ? reg.archivoDni : reg.archivoFicha;
          const res = await fetch(targetUrl);
          const blob = await res.blob();
          const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg';
          const sufijo = tipo === 'dni' ? 'DNI' : 'FICHA';
          const nombre = `${reg.apellidos}_${reg.nombres}_${reg.dni}_${sufijo}.${ext}`.replace(/\s+/g, '_');
          zip.file(nombre, blob);
        } catch {}
      }));
    }
    const contenido = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(contenido);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tipo === 'dni' ? 'DNIs' : 'Fichas'}_SIA_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDescargandoZip(false);
  };

  const exportarCSV = () => {
    if (registrosFiltrados.length === 0) return;
    const cabeceras = [
      "Estado", "Tipo Doc", "NRO Documento", "Apellidos", "Nombres", "Sexo", "Clase", 
      "Fecha Nacimiento", "Lugar Nacimiento", "Nacionalidad", "Profesión", "Estado Civil",
      "Celular", "Mail", "Distrito", "Localidad", "Calle", "Número", "Piso", "Dpto", 
      "Observaciones", "Comentario Error", "Cargado Por", "Subido JE Por", "Aprobado Por", "Link DNI", "Link Ficha"
    ];
    const filas = registrosFiltrados.map(reg => [
      reg.estado || 'pendiente', reg.tipoDocumento || 'DNI', reg.dni, reg.apellidos, reg.nombres, reg.sexo, reg.clase || '',
      reg.fechaNacimiento, reg.lugarNacimiento || '', reg.nacionalidad, reg.profesion || '', reg.estadoCivil || '',
      reg.celular || '', reg.mail || '', reg.distrito || 'Buenos Aires', reg.localidad, reg.calle, reg.numero,
      reg.piso || '', reg.dpto || '', reg.observaciones || '', reg.comentarioError || '', reg.afiliadorNombre || reg.afiliadorEmail || '',
      reg.subidoPor || '', reg.aprobadoPor || '', reg.archivoDni || '', reg.archivoFicha || ''
    ]);
    const contenidoCSV = [cabeceras.join(","), ...filas.map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Afiliados_SIA_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const procesarDNIUnicoImagen = async (): Promise<Blob> => {
    const getImgObj = (b64: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = b64;
      });
    };
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
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Error')); }, 'image/jpeg', 0.85);
    });
  };

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubiendo(true);
    try {
      let urlDni = '';
      let urlFicha = '';
      const ts = Date.now();

      if (!editandoId || (fotoFrenteB64 && fotoDorsoB64) || archivoUnico) {
        if (modoArchivo === 'escaner' && fotoFrenteB64 && fotoDorsoB64) {
          const blob = await procesarDNIUnicoImagen();
          const refDni = ref(storage, `dnis/${formData.dni}-${ts}.jpg`);
          await uploadBytes(refDni, blob, { contentType: 'image/jpeg' });
          urlDni = await getDownloadURL(refDni);
        } else if (modoArchivo === 'unico' && archivoUnico) {
          const refDni = ref(storage, `dnis/${formData.dni}-${ts}`);
          await uploadBytes(refDni, archivoUnico);
          urlDni = await getDownloadURL(refDni);
        }
      }

      if (fotoFichaB64) {
        const resF = await fetch(fotoFichaB64);
        const blobF = await resF.blob();
        const refFicha = ref(storage, `fichas/${formData.dni}-${ts}.jpg`);
        await uploadBytes(refFicha, blobF, { contentType: 'image/jpeg' });
        urlFicha = await getDownloadURL(refFicha);
      }

      if (editandoId) {
        const payload: any = { ...formData, últimaModificación: serverTimestamp() };
        if (urlDni) payload.archivoDni = urlDni;
        if (urlFicha) payload.archivoFicha = urlFicha;
        await updateDoc(doc(db, 'afiliaciones', editandoId), payload);
      } else {
        await addDoc(collection(db, 'afiliaciones'), { ...formData, archivoDni: urlDni, archivoFicha: urlFicha, afiliadorNombre: (user as any).displayName || '', afiliadorEmail: (user as any).email, afiliadorUid: (user as any).uid, fecha: serverTimestamp() });
      }

      setEditandoId(null);
      setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estado: 'pendiente', comentarioError: '', subidoPor: '', aprobadoPor: '' });
      setFotoFrenteB64(null); setFotoDorsoB64(null); setFotoFichaB64(null); setArchivoUnico(null);
      cambiarTab('registros');
    } catch (error) {
      alert('Error de base de datos.');
    } finally {
      setSubiendo(false);
    }
  };

  const prepararEdicion = (reg: any) => {
    setFormData({
      ...reg,
      tipoDocumento: reg.tipoDocumento || 'DNI',
      clase: reg.clase || '',
      lugarNacimiento: reg.lugarNacimiento || '',
      profesion: reg.profesion || '',
      estadoCivil: reg.estadoCivil || '',
      celular: reg.celular || '',
      mail: reg.mail || '',
      distrito: reg.distrito || 'Buenos Aires',
      estado: reg.estado || 'pendiente',
      comentarioError: reg.comentarioError || '',
      subidoPor: reg.subidoPor || '',
      aprobadoPor: reg.aprobadoPor || ''
    });
    setEditandoId(reg.id);
    cambiarTab('editar');
  };

  const prepararNueva = () => {
    setEditandoId(null);
    setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estado: 'pendiente', comentarioError: '', subidoPor: '', aprobadoPor: '' });
    setFotoFrenteB64(null); setFotoDorsoB64(null); setFotoFichaB64(null); setArchivoUnico(null);
    cambiarTab('nueva');
  };

  if (loading) return <div className="p-10 text-center font-bold text-gray-900 text-lg">Iniciando SIA...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4 text-gray-900">
        <img src="/logo.png" alt="SIA Logo" className="w-32 h-32 mb-6" />
        <h1 className="text-4xl md:text-5xl font-black mb-8 tracking-tighter text-center">SIA GESTIÓN</h1>
        <button onClick={loginConGoogle} className="bg-purple-900 text-white font-bold px-10 py-4 rounded-2xl shadow-xl flex items-center gap-3 hover:bg-purple-800 transition text-lg">
          Ingresar con Gmail
        </button>
      </div>
    );
  }

  if (role === 'pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-200 max-w-md">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4">Acceso Pendiente</h2>
          <p className="text-gray-600 mb-8 leading-relaxed font-medium text-base">Tu perfil está siendo validado. Te notificaremos una vez que puedas cargar fichas.</p>
          <button onClick={logout} className="text-purple-900 font-black uppercase tracking-widest text-sm hover:underline">Cerrar Sesión</button>
        </div>
      </div>
    );
  }

  const actualizarRol = async (uid: string, nuevoRol: string) => {
    try { await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol }); } 
    catch (e) { alert('Error de red'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      
      {camaraActiva && (
        <EscanerDocumento 
          titulo={camaraActiva === 'frente' ? "Escanear Frente DNI" : camaraActiva === 'dorso' ? "Escanear Dorso DNI" : "Escanear Ficha Física"}
          tipo={camaraActiva === 'fichaExtra' || camaraActiva === 'ficha' ? 'ficha' : 'dni'}
          onClose={() => setCamaraActiva(null)} 
          onCapture={(dataUrl) => {
            if (camaraActiva === 'frente') setFotoFrenteB64(dataUrl);
            else if (camaraActiva === 'dorso') setFotoDorsoB64(dataUrl);
            else if (camaraActiva === 'ficha') setFotoFichaB64(dataUrl);
            else if (camaraActiva === 'fichaExtra' && fichaSeleccionada) adjuntarFichaFisica(fichaSeleccionada.id, fichaSeleccionada.dni, dataUrl);
            setCamaraActiva(null);
          }} 
        />
      )}

      <header className="bg-white px-6 py-4 sticky top-0 z-40 flex justify-between items-center border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
          <div>
            <h2 className="font-black text-lg md:text-2xl text-purple-950 leading-none">SIA GESTIÓN</h2>
            <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{isAdmin ? 'ADMINISTRADOR' : 'AFILIADOR'}</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-2">
          <button onClick={prepararNueva} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${tab === 'nueva' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Nueva</button>
          <button onClick={() => cambiarTab('registros')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${tab === 'registros' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Fichas</button>
          {isAdmin && <button onClick={() => cambiarTab('control')} className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition ${tab === 'control' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}><IconPC /> Panel Control</button>}
          {isAdmin && <button onClick={() => cambiarTab('usuarios')} className={`px-4 py-2 rounded-lg font-bold text-sm transition ${tab === 'usuarios' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Usuarios</button>}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button onClick={logout} className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition">Salir</button>
        </div>
        
        <button onClick={logout} className="md:hidden bg-gray-100 text-gray-900 px-3 py-2 rounded-xl text-[10px] font-black">SALIR</button>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 pb-32 md:pb-8">
        
        {tab === 'control' && isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col min-h-[70vh]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-black">Panel de Control de Fichas</h3>
                <p className="text-xs font-bold text-gray-500 uppercase mt-1">Gestión Centralizada y Auditoría</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportarCSV} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-green-700 transition">EXCEL</button>
                <button onClick={() => descargarZip('dni')} disabled={descargandoZip} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black disabled:opacity-50 transition hover:bg-blue-700">ZIP DNIs</button>
                <button onClick={() => descargarZip('ficha')} disabled={descargandoZip} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black disabled:opacity-50 transition hover:bg-purple-700">ZIP FICHAS</button>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <input placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="p-2 border rounded outline-none text-sm w-64" />
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="p-2 border rounded text-sm font-bold w-48">
                <option value="todas">Todos los Estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="subida">Subidas a JE</option>
                <option value="aprobada">Aprobadas</option>
                <option value="error">Con Error</option>
              </select>
            </div>

            <div className="overflow-x-auto border rounded-xl flex-1">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 font-black text-gray-700">Afiliado</th>
                    <th className="p-4 font-black text-gray-700">Archivos</th>
                    <th className="p-4 font-black text-gray-700">Estado Actual</th>
                    <th className="p-4 font-black text-gray-700">Auditoría</th>
                    <th className="p-4 font-black text-right text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrosFiltrados.map(reg => (
                    <tr key={reg.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold">{reg.apellidos}, {reg.nombres}</div>
                        <div className="text-xs text-gray-500">{reg.dni}</div>
                      </td>
                      <td className="p-4 flex gap-2 items-center h-full pt-6">
                        {reg.archivoDni ? <a href={reg.archivoDni} target="_blank" className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-black hover:bg-blue-200">DNI</a> : <span className="bg-gray-100 text-gray-400 px-2 py-1 rounded text-[10px] font-black">NO DNI</span>}
                        {reg.archivoFicha ? <a href={reg.archivoFicha} target="_blank" className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-[10px] font-black hover:bg-purple-200">FICHA</a> : <button onClick={() => { setFichaSeleccionada(reg); setCamaraActiva('fichaExtra'); }} className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] font-black cursor-pointer hover:bg-yellow-200 transition">+ FICHA</button>}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${reg.estado === 'pendiente' ? 'bg-gray-200 text-gray-600' : reg.estado === 'subida' ? 'bg-blue-200 text-blue-900' : reg.estado === 'aprobada' ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900'}`}>{reg.estado}</span>
                        {reg.estado === 'error' && <div className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate font-bold" title={reg.comentarioError}>{reg.comentarioError}</div>}
                      </td>
                      <td className="p-4 text-[10px]">
                        <div><span className="font-bold">Creó:</span> {reg.afiliadorNombre}</div>
                        {reg.subidoPor && <div><span className="font-bold text-blue-700">Subió:</span> {reg.subidoPor}</div>}
                        {reg.aprobadoPor && <div><span className="font-bold text-green-700">Aprobó:</span> {reg.aprobadoPor}</div>}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {reg.estado !== 'subida' && reg.estado !== 'aprobada' && <button onClick={() => cambiarEstado(reg.id, 'subida')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-700 transition">Subir JE</button>}
                        {reg.estado === 'subida' && <button onClick={() => cambiarEstado(reg.id, 'aprobada')} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-bold hover:bg-green-700 transition">Aprobar</button>}
                        {reg.estado !== 'aprobada' && <button onClick={() => { const m = prompt("Motivo del error:"); if(m) cambiarEstado(reg.id, 'error', m); }} className="text-xs border border-red-600 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-50 transition">Error</button>}
                        <button onClick={() => { setFormData({...reg}); setEditandoId(reg.id); cambiarTab('editar'); }} className="text-xs underline text-gray-500 hover:text-gray-900 ml-2">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'usuarios' && isAdmin && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50"><h3 className="font-black text-xl text-gray-900">Control de Accesos</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm md:text-base">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="p-4 font-black text-gray-900 uppercase">Usuario</th>
                    <th className="p-4 font-black text-gray-900 uppercase">Rol</th>
                    <th className="p-4 text-right font-black text-gray-900 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosSistema.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{u.nombre}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase ${u.rol === 'admin' ? 'bg-purple-900 text-white' : u.rol === 'afiliador' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        {u.rol !== 'afiliador' && <button onClick={() => actualizarRol(u.id, 'afiliador')} className="bg-black text-white text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-800">AUTORIZAR</button>}
                        {u.rol !== 'admin' && u.email !== (user as any).email && <button onClick={() => actualizarRol(u.id, 'admin')} className="border-2 border-black text-black text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-100">ADMIN</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'detalle' && fichaSeleccionada && !isAdmin && (
          <div className="bg-white p-6 md:p-10 rounded-2xl shadow-md border border-gray-200">
            <button onClick={() => cambiarTab('registros')} className="text-purple-900 mb-6 font-bold text-sm flex items-center gap-2 hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              Volver a Fichas
            </button>
            <h3 className="text-3xl font-black text-gray-900 leading-tight">{fichaSeleccionada.apellidos}, {fichaSeleccionada.nombres}</h3>
            <p className="text-sm font-bold text-gray-500 mb-6 mt-2">DNI: {fichaSeleccionada.dni} - Estado: <span className="text-purple-900 uppercase">{fichaSeleccionada.estado}</span></p>
            <div className="grid grid-cols-2 gap-6 text-sm mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nacimiento</span><p className="font-bold text-gray-900">{fichaSeleccionada.fechaNacimiento}</p></div>
              <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</span><p className="font-bold text-gray-900">{fichaSeleccionada.celular}</p></div>
              <div className="col-span-2"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dirección</span><p className="font-bold text-gray-900">{fichaSeleccionada.calle} {fichaSeleccionada.numero}, {fichaSeleccionada.localidad}</p></div>
            </div>
            <button onClick={() => { setFormData({...fichaSeleccionada}); setEditandoId(fichaSeleccionada.id); cambiarTab('editar'); }} className="w-full py-4 bg-gray-100 rounded-xl font-bold text-xs uppercase tracking-widest text-gray-600 hover:bg-gray-200 transition">Editar Datos Formulario</button>
          </div>
        )}

        {(tab === 'nueva' || tab === 'editar') && (
          <form onSubmit={guardarFicha} className="space-y-6 bg-white p-6 md:p-10 rounded-2xl shadow-md border border-gray-200">
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight border-b border-gray-100 pb-4">
              {tab === 'editar' ? '✏️ Editando Ficha' : '📝 Nueva Ficha'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Apellidos</label>
                <input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>
              
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Nombres</label>
                <input type="text" name="nombres" value={formData.nombres} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>
              
              <div className="flex gap-2">
                <div className="w-1/3">
                  <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Tipo</label>
                  <select name="tipoDocumento" value={formData.tipoDocumento} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-bold focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required>
                    <option value="DNI">DNI</option>
                    <option value="LE">LE</option>
                    <option value="LC">LC</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">NRO</label>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" name="dni" value={formData.dni} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-bold focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Sexo</label>
                <select name="sexo" value={formData.sexo} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required>
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Estado Civil</label>
                <select name="estadoCivil" value={formData.estadoCivil} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required>
                  <option value="">Seleccionar...</option>
                  <option value="Soltero/a">Soltero/a</option>
                  <option value="Casado/a">Casado/a</option>
                  <option value="Divorciado/a">Divorciado/a</option>
                  <option value="Viudo/a">Viudo/a</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Fecha Nacimiento</label>
                <div className="relative flex items-center">
                  <input type="text" inputMode="numeric" maxLength={10} name="fechaNacimiento" placeholder="DD/MM/AAAA" value={formData.fechaNacimiento} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base pr-12" required />
                  <div className="absolute right-2 w-10 h-10 flex items-center justify-center bg-purple-100 text-purple-900 rounded-lg hover:bg-purple-200 transition overflow-hidden">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 pointer-events-none"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => { const val = e.target.value; if (val) { const [y, m, d] = val.split('-'); setFormData({ ...formData, fechaNacimiento: `${d}/${m}/${y}` }); } }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Clase (Año)</label>
                <input type="text" inputMode="numeric" maxLength={4} name="clase" value={formData.clase} onChange={handleChange} placeholder="Ej: 1985" className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Lugar de Nacim.</label>
                <input type="text" name="lugarNacimiento" value={formData.lugarNacimiento} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Nacionalidad</label>
                <input type="text" name="nacionalidad" value={formData.nacionalidad} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Profesión</label>
                <input type="text" name="profesion" value={formData.profesion} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Celular</label>
                <input type="tel" inputMode="numeric" name="celular" value={formData.celular} onChange={handleChange} placeholder="Ej: 1123456789" className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Email</label>
                <input type="email" name="mail" value={formData.mail} onChange={handleChange} placeholder="Ej: correo@gmail.com" className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" />
              </div>
            </div>

            <div className="bg-purple-950 p-6 md:p-8 rounded-2xl text-white space-y-6 shadow-md mt-8">
               <h4 className="text-sm md:text-base font-black uppercase tracking-widest border-b border-purple-800 pb-4">Ubicación del Domicilio</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Distrito</label>
                   <input type="text" value="Buenos Aires" readOnly className="w-full p-3 md:p-4 bg-purple-900/50 border border-purple-700 rounded-xl text-white font-bold cursor-not-allowed outline-none text-base" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Localidad</label>
                   <select name="localidad" value={formData.localidad} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" required>
                     <option value="">Seleccionar...</option>
                     <option value="Acassuso">Acassuso</option>
                     <option value="Beccar">Beccar</option>
                     <option value="Boulogne">Boulogne</option>
                     <option value="Martínez">Martínez</option>
                     <option value="San Isidro">San Isidro</option>
                     <option value="Villa Adelina">Villa Adelina</option>
                   </select>
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Calle</label>
                   <input type="text" name="calle" value={formData.calle} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" required />
                 </div>
                 <div className="flex gap-4 md:col-span-2">
                   <div className="flex-1">
                     <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Número</label>
                     <input type="number" inputMode="numeric" pattern="[0-9]*" name="numero" value={formData.numero} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" required />
                   </div>
                   <div className="w-24">
                     <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Piso</label>
                     <input type="text" name="piso" value={formData.piso} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" />
                   </div>
                   <div className="w-24">
                     <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Dpto</label>
                     <input type="text" name="dpto" value={formData.dpto} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" />
                   </div>
                 </div>
               </div>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2 mt-8">Observaciones</label>
              <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" rows={3}></textarea>
            </div>

            {!editandoId && (
              <div className="space-y-6 pt-6 border-t border-gray-200 mt-8">
                <h4 className="text-base font-black text-gray-900 uppercase tracking-wide">Captura de Documentación</h4>
                
                <div className="flex bg-gray-100 p-2 rounded-xl max-w-sm mb-4">
                  <button type="button" onClick={() => setModoArchivo('escaner')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase tracking-wider ${modoArchivo === 'escaner' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Cámara</button>
                  <button type="button" onClick={() => setModoArchivo('unico')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase tracking-wider ${modoArchivo === 'unico' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Archivo Local</button>
                </div>
                
                {modoArchivo === 'escaner' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-xs font-bold text-gray-900 mb-4 uppercase tracking-widest">{fotoFrenteB64 ? 'FRENTE Listo' : '1. FRENTE DNI'}</span>
                      <button type="button" onClick={() => setCamaraActiva('frente')} className={`w-full h-20 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoFrenteB64 ? { backgroundImage: `url(${fotoFrenteB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoFrenteB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoFrenteB64 && <button type="button" onClick={() => setFotoFrenteB64(null)} className="text-red-500 text-[10px] font-bold mt-2 uppercase hover:underline">Borrar</button>}
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-xs font-bold text-gray-900 mb-4 uppercase tracking-widest">{fotoDorsoB64 ? 'DORSO Listo' : '2. DORSO DNI'}</span>
                      <button type="button" onClick={() => setCamaraActiva('dorso')} className={`w-full h-20 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoDorsoB64 ? { backgroundImage: `url(${fotoDorsoB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoDorsoB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoDorsoB64 && <button type="button" onClick={() => setFotoDorsoB64(null)} className="text-red-500 text-[10px] font-bold mt-2 uppercase hover:underline">Borrar</button>}
                    </div>
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-xs font-bold text-gray-900 mb-4 uppercase tracking-widest">{fotoFichaB64 ? 'FICHA Lista' : '3. FICHA (OPCIONAL)'}</span>
                      <button type="button" onClick={() => setCamaraActiva('ficha')} className={`w-full h-20 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoFichaB64 ? { backgroundImage: `url(${fotoFichaB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoFichaB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
                      </button>
                      {fotoFichaB64 && <button type="button" onClick={() => setFotoFichaB64(null)} className="text-red-500 text-[10px] font-bold mt-2 uppercase hover:underline">Borrar</button>}
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 bg-gray-50 text-center hover:bg-gray-100 transition max-w-xl">
                     <label className="cursor-pointer block">
                       <span className="block text-sm font-bold text-gray-900 mb-4 uppercase">{archivoUnico ? 'ARCHIVO CARGADO' : 'SELECCIONAR PDF O IMAGEN'}</span>
                       <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivoUnico(e.target.files ? e.target.files[0] : null)} className="hidden" />
                       <div className={`w-full h-16 rounded-xl flex items-center justify-center border border-gray-300 ${archivoUnico ? 'bg-green-500 border-green-500' : 'bg-white'}`}>
                         {archivoUnico ? <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> : <span className="text-gray-500 font-medium text-sm">Examinar en el dispositivo...</span>}
                       </div>
                     </label>
                  </div>
                )}
              </div>
            )}

            <button disabled={subiendo} className={`w-full py-5 md:py-6 rounded-2xl font-black text-lg md:text-xl text-white tracking-wide transition mt-10 shadow-lg ${subiendo ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-950 hover:bg-black'}`}>
              {subiendo ? 'PROCESANDO DATOS...' : (editandoId ? 'ACTUALIZAR FICHA' : 'REGISTRAR AFILIACIÓN')}
            </button>
          </form>
        )}

        {tab === 'registros' && (
          <div className="space-y-4">
            
            <div className="flex flex-col md:flex-row gap-4 mb-6 border-b border-gray-200 pb-6">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <input type="text" placeholder="Buscar por DNI, Nombre o Apellido..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full pl-10 pr-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:border-purple-900 focus:ring-1 focus:ring-purple-900 font-medium text-gray-900" />
              </div>
            </div>

            <div className="flex justify-between items-end mb-4">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Listado Operativo</h3>
              <div className="bg-purple-100 text-purple-900 px-4 py-2 rounded-lg font-black text-sm border border-purple-200">
                Resultados: {registrosFiltrados.length}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {registrosFiltrados.map((reg) => (
                <div 
                  key={reg.id} 
                  onClick={() => { if(isAdmin) cambiarTab('control'); else { setFichaSeleccionada(reg); cambiarTab('detalle'); } }} 
                  className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center hover:border-purple-300 hover:bg-purple-50 active:scale-[0.98] transition cursor-pointer 
                    ${reg.estado === 'error' ? 'border-l-4 border-l-red-500' : reg.estado === 'subida' ? 'border-l-4 border-l-blue-500' : reg.estado === 'aprobada' ? 'border-l-4 border-l-green-500' : ''}`}
                >
                  <div>
                    <div className="text-lg font-black text-gray-900 leading-tight">{reg.dni}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase mt-0.5">{reg.apellidos}, {reg.nombres}</div>
                    <div className="flex gap-1 mt-2">
                      {reg.archivoDni ? <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[8px] font-black uppercase">DNI</span> : <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">NO DNI</span>}
                      {reg.archivoFicha ? <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[8px] font-black uppercase">FICHA</span> : <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">NO FICHA</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`w-3 h-3 rounded-full ${reg.estado === 'pendiente' ? 'bg-gray-300' : reg.estado === 'subida' ? 'bg-blue-500' : reg.estado === 'aprobada' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-gray-300"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </div>
                </div>
              ))}
            </div>
            {registrosFiltrados.length === 0 && (
              <p className="py-20 text-center font-bold text-gray-400 text-lg">No se encontraron fichas.</p>
            )}
          </div>
        )}
      </main>

      {!camaraActiva && (
        <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
          <nav className="bg-white/80 backdrop-blur-xl border border-gray-200 shadow-xl flex gap-2 p-2 rounded-[2rem] w-full max-w-sm">
            <button onClick={prepararNueva} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'nueva' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
              <IconNueva />
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">Nueva</span>
            </button>
            <button onClick={() => cambiarTab('registros')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'registros' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
              <IconFichas />
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">Fichas</span>
            </button>
            {isAdmin && (
              <button onClick={() => cambiarTab('control')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'control' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
                <IconPC />
                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Control</span>
              </button>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}