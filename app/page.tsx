'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';
import { AppShell } from './components/shell/AppShell';
import { RecordsView } from './components/records/RecordsView';
import { FichaForm } from './components/ficha/FichaForm';
import { FichaDetalle } from './components/ficha/FichaDetalle';
import { ControlView } from './components/control/ControlView';
import { UsuariosView } from './components/users/UsuariosView';
import { Login, PerfilPendiente } from './components/auth/AuthScreens';
import type { Rol } from './lib/types';
import type { TabKey } from './components/shell/nav';

const IconNueva = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const IconFichas = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const IconUsuarios = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;
const IconControl = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>;

const EscanerDocumento = ({ onClose, onCapture, titulo, tipo = 'dni' }: { onClose: () => void, onCapture: (imgData: string) => void, titulo: string, tipo?: 'dni' | 'ficha' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const proporcionMarco = tipo === 'ficha' ? 'aspect-[1.66]' : 'aspect-[1.58]';

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
        alert("No se pudo acceder a la cÃ¡mara.");
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
        <div ref={marcoRef} className={`relative w-[85%] ${proporcionMarco} border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none`}>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
          <p className="absolute inset-0 flex items-center justify-center text-white/50 font-bold text-lg uppercase tracking-widest text-center">
            {tipo === 'ficha' ? 'Alinee la ficha' : 'Alinee el DNI'}
          </p>
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
  const { user, loading, role, userData, isAdmin, isSupervisor, isAdminOrSupervisor, loginConGoogle, logout } = useAuth();
  
  const [mostrarIntro, setMostrarIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMostrarIntro(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  const [tab, setTab] = useState<'nueva' | 'registros' | 'usuarios' | 'detalle' | 'editar' | 'control'>('registros');
  
  const [formData, setFormData] = useState({
    tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', 
    sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', 
    nacionalidad: '', profesion: '', estadoCivil: '', 
    celular: '', mail: '',
    distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: '', estadoControl: 'pendiente'
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<any>(null);
  
  const [modoArchivo, setModoArchivo] = useState<'escaner' | 'unico'>('escaner');
  const [camaraActiva, setCamaraActiva] = useState<null | 'frente' | 'dorso' | 'fichaControl'>(null);
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [archivoUnico, setArchivoUnico] = useState<File | null>(null);
  
  const [subiendo, setSubiendo] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState<string | null>(null);
  
  const [busqueda, setBusqueda] = useState('');
  const [filtroAfiliador, setFiltroAfiliador] = useState('todas');

  const [editandoUsuarioId, setEditandoUsuarioId] = useState<string | null>(null);
  const [formEditUsuario, setFormEditUsuario] = useState({ nombre: '', apellido: '' });
  const [formPerfil, setFormPerfil] = useState({ nombre: '', apellido: '' });
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [filtroControl, setFiltroControl] = useState('todas');
  const [filtroControlAfiliador, setFiltroControlAfiliador] = useState('todas');
  const [busquedaControl, setBusquedaControl] = useState('');
  const [fichaControlDetalleId, setFichaControlDetalleId] = useState<string | null>(null);
  const [textoErrorJE, setTextoErrorJE] = useState('');
  const [textoSuspension, setTextoSuspension] = useState('');
  const [accionSuspension, setAccionSuspension] = useState<'suspendido' | 'baja' | null>(null);
  const [subiendoControl, setSubiendoControl] = useState(false);

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

  const cambiarTab = (nuevoTab: 'nueva' | 'registros' | 'usuarios' | 'detalle' | 'editar' | 'control') => {
    setTab(nuevoTab);
    window.history.pushState({ tab: nuevoTab }, '', '');
  };

  useEffect(() => {
    if (!user || role === 'pendiente') return;
    const q = isAdminOrSupervisor
      ? query(collection(db, 'afiliaciones'), orderBy('fecha', 'desc'))
      : query(collection(db, 'afiliaciones'), where('afiliadorUid', '==', (user as any).uid));
    return onSnapshot(q, (snapshot) => setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [user, isAdminOrSupervisor, role]);

  useEffect(() => {
    if (!isAdminOrSupervisor) return;
    const q = query(collection(db, 'usuarios'), orderBy('fechaRegistro', 'desc'));
    return onSnapshot(q, (snapshot) => setUsuariosSistema(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
  }, [isAdminOrSupervisor]);

  const estadoControlCfg: Record<string, { label: string; cls: string }> = {
    pendiente:  { label: 'Pendiente',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    firmado:    { label: 'Firmada',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    escaneado:  { label: 'Escaneada',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    cargado_je: { label: 'En JE',       cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    aprobado:   { label: 'Aprobada',    cls: 'bg-green-100 text-green-700 border-green-200' },
    error:      { label: 'Con Error',   cls: 'bg-red-50 text-red-700 border-red-200' },
    suspendido: { label: 'Suspendido',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    baja:       { label: 'Dado de baja', cls: 'bg-red-100 text-red-800 border-red-300' },
  };

  const fmtTs = (ts: any): string => {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const registrosFiltrados = registros.filter((reg) => {
    if (isAdminOrSupervisor && filtroAfiliador !== 'todas' && reg.afiliadorUid !== filtroAfiliador) {
      return false;
    }
    
    if (busqueda.trim() !== '') {
      const b = busqueda.toLowerCase().trim();
      const coincideDni = reg.dni?.toLowerCase().includes(b);
      const coincideNombres = reg.nombres?.toLowerCase().includes(b);
      const coincideApellidos = reg.apellidos?.toLowerCase().includes(b);
      
      if (!coincideDni && !coincideNombres && !coincideApellidos) {
        return false;
      }
    }
    
    return true;
  });

  const registrosControl = isAdmin ? registros.filter((reg) => {
    const estado = reg.estadoControl || 'pendiente';
    if (filtroControl !== 'todas' && estado !== filtroControl) return false;
    if (filtroControlAfiliador !== 'todas' && reg.afiliadorUid !== filtroControlAfiliador) return false;
    if (busquedaControl.trim()) {
      const b = busquedaControl.toLowerCase();
      return reg.dni?.toLowerCase().includes(b) || reg.nombres?.toLowerCase().includes(b) || reg.apellidos?.toLowerCase().includes(b);
    }
    return true;
  }) : [];

  const fichaControlDetalle = fichaControlDetalleId ? (registros.find(r => r.id === fichaControlDetalleId) || null) : null;

  if (mostrarIntro) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center overflow-hidden p-4 md:p-8">
        <video 
          autoPlay 
          muted 
          playsInline 
          preload="auto"
          className="w-full h-full max-w-5xl max-h-[90vh] object-contain"
          onEnded={() => setMostrarIntro(false)} 
          onError={() => setMostrarIntro(false)}
        >
          <source src="/video.mp4" type="video/mp4" />
        </video>
      </div>
    );
  }

  if (loading) return <div className="p-10 text-center font-bold text-gray-900 text-lg">Iniciando SIA...</div>;

  if (!user) return <Login onLogin={loginConGoogle} />;
  if (role === 'pendiente') {
    return (
      <PerfilPendiente
        etapa={(userData as any)?.perfilCompleto ? 'espera' : 'form'}
        nombre={(userData as any)?.nombre}
        apellido={(userData as any)?.apellido}
        guardando={guardandoPerfil}
        onLogout={logout}
        onSubmit={async ({ nombre, apellido }) => {
          if (!user) return;
          setGuardandoPerfil(true);
          try {
            await updateDoc(doc(db, 'usuarios', (user as any).uid), {
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              perfilCompleto: true,
            });
            (user as any).getIdToken().then((idToken: string) => {
              fetch('/api/notificar-nuevo-usuario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ email: (user as any).email, nombre: `${nombre.trim()} ${apellido.trim()}` }),
              });
            }).catch(() => {});
          } catch {
            alert('Error al guardar. Intentá de nuevo.');
          } finally {
            setGuardandoPerfil(false);
          }
        }}
      />
    );
  }
  const actualizarRol = async (uid: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol });
    } catch (e) {
      alert('Error de red');
    }
  };

  const guardarNombreUsuario = async () => {
    if (!editandoUsuarioId) return;
    try {
      await updateDoc(doc(db, 'usuarios', editandoUsuarioId), {
        nombre: formEditUsuario.nombre.trim(),
        apellido: formEditUsuario.apellido.trim()
      });
      setEditandoUsuarioId(null);
    } catch {
      alert('Error al guardar');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'fechaNacimiento') {
      if (value.length < formData.fechaNacimiento.length) {
        setFormData({ ...formData, [name]: value }); return;
      }
      let val = value.replace(/\D/g, '');
      if (val.length > 8) val = val.substring(0, 8);
      let formatted = val;
      if (val.length > 4) formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4)}`;
      else if (val.length > 2) formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
      setFormData({ ...formData, [name]: formatted });
    } else if (name === 'clase') {
      let val = value.replace(/\D/g, '');
      if (val.length > 4) val = val.substring(0, 4);
      setFormData({ ...formData, [name]: val });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const descargarZip = async (tipo: 'dni' | 'ficha') => {
    const conArchivo = registrosFiltrados.filter(r => tipo === 'dni' ? r.archivoDni : r.archivoFicha);
    if (conArchivo.length === 0) {
      alert(`No hay archivos de ${tipo.toUpperCase()} para descargar.`);
      return;
    }
    setDescargandoZip(tipo);
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
    setDescargandoZip(null);
  };

  const exportarCSV = () => {
    if (registrosFiltrados.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const cabeceras = [
      "Estado", "Tipo Doc", "NRO Documento", "Apellidos", "Nombres", "Sexo", "Clase", 
      "Fecha Nacimiento", "Lugar Nacimiento", "Nacionalidad", "ProfesiÃ³n", "Estado Civil",
      "Celular", "Mail", "Distrito", "Localidad", "Calle", "NÃºmero", "Piso", "Dpto", 
      "Observaciones", "Cargado Por", "Link DNI", "Link Ficha"
    ];

    const filas = registrosFiltrados.map(reg => [
      reg.estadoControl || 'pendiente',
      reg.tipoDocumento || 'DNI',
      reg.dni,
      reg.apellidos,
      reg.nombres,
      reg.sexo,
      reg.clase || '',
      reg.fechaNacimiento,
      reg.lugarNacimiento || '',
      reg.nacionalidad,
      reg.profesion || '',
      reg.estadoCivil || '',
      reg.celular || '',
      reg.mail || '',
      reg.distrito || 'Buenos Aires',
      reg.localidad,
      reg.calle,
      reg.numero,
      reg.piso || '',
      reg.dpto || '',
      reg.observaciones || '',
      reg.afiliadorNombre || reg.afiliadorEmail || '',
      reg.archivoDni || 'Sin archivo',
      reg.archivoFicha || 'Sin archivo'
    ]);

    const contenidoCSV = [
      cabeceras.join(","),
      ...filas.map(fila => fila.map(campo => `"${String(campo).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

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
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error'));
      }, 'image/jpeg', 0.85);
    });
  };

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubiendo(true);

    try {
      let urlDni = '';
      if (!editandoId || fotoFrenteB64 || archivoUnico) {
        const timestamp = Date.now();
        const ruta = `dnis/${formData.dni}-${timestamp}.jpg`;
        const storageRef = ref(storage, ruta);

        if (modoArchivo === 'escaner' && fotoFrenteB64 && fotoDorsoB64) {
          const blob = await procesarDNIUnicoImagen();
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          urlDni = await getDownloadURL(storageRef);
        } else if (modoArchivo === 'unico' && archivoUnico) {
          const storageRefUnico = ref(storage, `dnis/${formData.dni}-${timestamp}`);
          await uploadBytes(storageRefUnico, archivoUnico);
          urlDni = await getDownloadURL(storageRefUnico);
        }
      }

      if (editandoId) {
        const payload: any = { ...formData, ['\u00faltimaModificaci\u00f3n']: serverTimestamp(), ...(urlDni && { archivoDni: urlDni }) };
        const est = (formData as any).estadoControl || 'pendiente';
        if (isAdmin && ['escaneado', 'cargado_je', 'aprobado', 'error', 'suspendido', 'baja'].includes(est)) {
          payload.editadoPorAdmin = (user as any).displayName || (user as any).email;
          payload.fechaEdicionAdmin = serverTimestamp();
        }
        await updateDoc(doc(db, 'afiliaciones', editandoId), payload);
        alert('Datos actualizados');
      } else {
        const nombreAfiliador = userData ? `${(userData as any).apellido || ''} ${(userData as any).nombre || ''}`.trim() : ((user as any).displayName || '');
        await addDoc(collection(db, 'afiliaciones'), { ...formData, archivoDni: urlDni, afiliadorNombre: nombreAfiliador, afiliadorEmail: (user as any).email, afiliadorUid: (user as any).uid, fecha: serverTimestamp() });
        alert('Registro exitoso');
      }

      setEditandoId(null);
      setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estadoControl: 'pendiente' });
      setFotoFrenteB64(null); setFotoDorsoB64(null); setArchivoUnico(null);
      cambiarTab('registros');
      
    } catch (error) {
      alert('Error al guardar en la base de datos.');
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
      estadoControl: reg.estadoControl || 'pendiente'
    });
    setEditandoId(reg.id);
    cambiarTab('editar');
  };

  const prepararNueva = () => {
    setEditandoId(null);
    setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '', estadoControl: 'pendiente' });
    setFotoFrenteB64(null); setFotoDorsoB64(null); setArchivoUnico(null);
    cambiarTab('nueva');
  };

  const actualizarControl = async (id: string, estado: string, extras: Record<string, any> = {}) => {
    try {
      const fichaActual = registros.find(r => r.id === id);
      const estadoAnterior = fichaActual?.estadoControl || 'pendiente';
      const u = user as any;
      const operador = u?.displayName || u?.email || 'Usuario';
      const operadorUid = u?.uid || null;
      const esReactivacion = ['suspendido', 'baja'].includes(estadoAnterior) && !['suspendido', 'baja'].includes(estado);
      const comentario = extras.errorJE || extras.suspendidoComentario || null;
      const fechaHistorial = new Date().toISOString();

      const payload: Record<string, any> = {
        estadoControl: estado,
        ...extras,
        fechaUltimoControl: serverTimestamp(),
        ultimoControlPor: operador,
        ultimoControlPorUid: operadorUid,
        historialControl: arrayUnion({
          accion: esReactivacion ? 'reactivacion' : estado,
          estadoAnterior,
          estadoNuevo: estado,
          fecha: fechaHistorial,
          por: operador,
          uid: operadorUid,
          comentario,
        }),
      };

      if (estado === 'escaneado') {
        payload.fechaEscaneado = extras.fechaEscaneado || serverTimestamp();
        payload.escaneadoPor = extras.escaneadoPor || operador;
        payload.escaneadoPorUid = extras.escaneadoPorUid || operadorUid;
      }
      if (estado === 'cargado_je') {
        payload.fechaCargaJE = serverTimestamp();
        payload.cargadoJEPor = operador;
        payload.cargadoJEPorUid = operadorUid;
      }
      if (estado === 'aprobado') {
        payload.fechaAprobacion = serverTimestamp();
        payload.aprobadoPor = operador;
        payload.aprobadoPorUid = operadorUid;
      }
      if (estado === 'error') {
        payload.fechaErrorJE = serverTimestamp();
        payload.errorPor = operador;
        payload.errorPorUid = operadorUid;
      }
      if (estado === 'suspendido') {
        payload.estadoAnterior = estadoAnterior;
        payload.fechaSuspension = serverTimestamp();
        payload.suspendidoPor = operador;
        payload.suspendidoPorUid = operadorUid;
      }
      if (estado === 'baja') {
        payload.estadoAnterior = estadoAnterior;
        payload.fechaBaja = serverTimestamp();
        payload.bajaPor = operador;
        payload.bajaPorUid = operadorUid;
        payload.suspendidoPor = operador;
        payload.suspendidoPorUid = operadorUid;
      }
      if (esReactivacion) {
        payload.fechaReactivacion = serverTimestamp();
        payload.reactivadoPor = operador;
        payload.reactivadoPorUid = operadorUid;
      }

      await updateDoc(doc(db, 'afiliaciones', id), payload);
    } catch {
      alert('Error al actualizar estado.');
    }
  };

  const subirFichaControlExtra = async (id: string, b64OrFile: string | File) => {
    setSubiendoControl(true);
    const u = user as any;
    try {
      let blob: Blob;
      const contentType = 'image/jpeg';
      const extension = 'jpg';

      if (typeof b64OrFile === 'string') {
        blob = await (await fetch(b64OrFile)).blob();
      } else {
        blob = b64OrFile;
      }

      const storageRef = ref(storage, `fichas/${id}-${Date.now()}.${extension}`);
      await uploadBytes(storageRef, blob, { contentType });
      const url = await getDownloadURL(storageRef);
      
      await actualizarControl(id, 'escaneado', {
        archivoFicha: url,
        fechaEscaneado: serverTimestamp(),
        escaneadoPor: u.displayName || u.email,
        escaneadoPorUid: u.uid,
        fechaFirma: serverTimestamp(),
        firmadoPor: u.displayName || u.email,
        firmadoPorUid: u.uid
      });
    } catch (error: any) {
      console.error("Detalle del error:", error);
      alert(`Error al subir: ${error.message || 'RevisÃ¡ la consola para mÃ¡s detalles.'}`);
    } finally {
      setSubiendoControl(false);
    }
  };

  const afiliadores = usuariosSistema
    .filter(u => u.rol !== 'pendiente')
    .map(u => ({
      uid: u.id,
      nombre: [u.apellido, u.nombre].filter(Boolean).join(', ') || u.email || 'Sin nombre',
    }));
  const roleActual = role as unknown as Rol;

  const navegar = (nuevoTab: TabKey) => {
    if (nuevoTab === 'nueva') {
      prepararNueva();
      return;
    }
    cambiarTab(nuevoTab);
  };

  return (
    <AppShell
      role={roleActual}
      userData={userData as any}
      tab={tab as TabKey}
      search={tab === 'control' ? busquedaControl : busqueda}
      setSearch={tab === 'control' ? setBusquedaControl : setBusqueda}
      onNav={navegar}
      onNueva={prepararNueva}
      onLogout={logout}
    >
      {camaraActiva && (
        <EscanerDocumento
          titulo={camaraActiva === 'frente' ? "Escanear Frente DNI" : camaraActiva === 'dorso' ? "Escanear Dorso DNI" : "Escanear Ficha"}
          tipo={camaraActiva.includes('ficha') ? 'ficha' : 'dni'}
          onClose={() => setCamaraActiva(null)}
          onCapture={(dataUrl) => {
            if (camaraActiva === 'frente') setFotoFrenteB64(dataUrl);
            else if (camaraActiva === 'dorso') setFotoDorsoB64(dataUrl);
            else if (camaraActiva === 'fichaControl') {
              const targetId = fichaControlDetalleId || (fichaSeleccionada ? fichaSeleccionada.id : null);
              if (targetId) subirFichaControlExtra(targetId, dataUrl);
            }
            setCamaraActiva(null);
          }}
        />
      )}

      {tab === 'registros' && (
        <RecordsView
          role={roleActual}
          registros={registros}
          afiliadores={afiliadores}
          search={busqueda}
          onOpenDetalle={(id) => {
            setFichaSeleccionada(registros.find(r => r.id === id) || null);
            cambiarTab('detalle');
          }}
          onExportCSV={exportarCSV}
          onDescargarZip={() => descargarZip('dni')}
        />
      )}

      {tab === 'detalle' && fichaSeleccionada && (
        <FichaDetalle
          ficha={fichaSeleccionada}
          role={roleActual}
          onBack={() => cambiarTab('registros')}
          onEdit={prepararEdicion}
        />
      )}

      {(tab === 'nueva' || tab === 'editar') && (
        <FichaForm
          formData={formData}
          onChange={handleChange}
          onSubmit={guardarFicha}
          onCancel={() => cambiarTab('registros')}
          editando={!!editandoId}
          subiendo={subiendo}
          dni={{
            modo: modoArchivo,
            setModo: setModoArchivo,
            frenteOk: !!fotoFrenteB64,
            dorsoOk: !!fotoDorsoB64,
            onScanFrente: () => setCamaraActiva('frente'),
            onScanDorso: () => setCamaraActiva('dorso'),
            onPickFile: (file) => setArchivoUnico(file),
          }}
        />
      )}

      {tab === 'usuarios' && isAdminOrSupervisor && (
        <UsuariosView
          role={roleActual}
          usuarios={usuariosSistema}
          actualizarRol={(uid, rol) => actualizarRol(uid, rol)}
          guardarNombre={(uid, datos) => updateDoc(doc(db, 'usuarios', uid), datos)}
        />
      )}

      {tab === 'control' && isAdmin && (
        <ControlView
          fichas={registros}
          afiliadores={afiliadores}
          search={busquedaControl}
          actualizarControl={actualizarControl}
          onOpenFicha={(id) => {
            setFichaSeleccionada(registros.find(r => r.id === id) || null);
            cambiarTab('detalle');
          }}
          onSubirFichaFisica={(id) => {
            setFichaControlDetalleId(id);
            setCamaraActiva('fichaControl');
          }}
        />
      )}
    </AppShell>
  );

}
