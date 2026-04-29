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
const IconControl = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>;

const EscanerDNI = ({ onClose, onCapture, titulo }: { onClose: () => void, onCapture: (imgData: string) => void, titulo: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let currentStream: MediaStream;
    const encenderCamara = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        currentStream = stream;
      } catch (err) {
        alert("No se pudo acceder a la cámara. Verifica los permisos de tu navegador.");
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

    const margenX = marcoRect.width * 0.1;
    const margenY = marcoRect.height * 0.1;

    const sx = Math.max(0, (marcoRect.left - videoRect.left - margenX) * scaleX);
    const sy = Math.max(0, (marcoRect.top - videoRect.top - margenY) * scaleY);
    const sWidth = Math.min(video.videoWidth - sx, (marcoRect.width + margenX * 2) * scaleX);
    const sHeight = Math.min(video.videoHeight - sy, (marcoRect.height + margenY * 2) * scaleY);

    canvas.width = sWidth;
    canvas.height = sHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
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
        <div ref={marcoRef} className="relative w-[85%] aspect-[1.58] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
          <p className="absolute inset-0 flex items-center justify-center text-white/50 font-bold text-lg uppercase tracking-widest text-center">Alinee el DNI<br/>y tome la foto</p>
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
  
  const [tab, setTab] = useState<'nueva' | 'registros' | 'usuarios' | 'detalle' | 'editar' | 'control'>('registros');
  
  const [formData, setFormData] = useState({
    tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', 
    sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', 
    nacionalidad: '', profesion: '', estadoCivil: '', 
    celular: '', mail: '',
    distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: ''
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [fichaSeleccionada, setFichaSeleccionada] = useState<any>(null);
  
  const [modoArchivo, setModoArchivo] = useState<'escaner' | 'unico'>('escaner');
  const [camaraActiva, setCamaraActiva] = useState<null | 'frente' | 'dorso'>(null);
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [archivoUnico, setArchivoUnico] = useState<File | null>(null);
  
  const [subiendo, setSubiendo] = useState(false);
  const [descargandoZip, setDescargandoZip] = useState(false);
  
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
  const [archivoFichaEscaneada, setArchivoFichaEscaneada] = useState<File | null>(null);
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
    if (!userData?.perfilCompleto) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
          <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-200 max-w-md w-full">
            <img src="/logo.png" alt="SIA Logo" className="w-14 h-14 mb-4 mx-auto object-contain" />
            <h2 className="text-2xl font-black text-gray-900 mb-1">Completar Perfil</h2>
            <p className="text-gray-500 text-sm font-medium mb-8">Ingresá tu nombre y apellido para solicitar acceso al sistema.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                setGuardandoPerfil(true);
                try {
                  await updateDoc(doc(db, 'usuarios', (user as any).uid), {
                    nombre: formPerfil.nombre.trim(),
                    apellido: formPerfil.apellido.trim(),
                    perfilCompleto: true
                  });
                  (user as any).getIdToken().then((idToken: string) => {
                    fetch('/api/notificar-nuevo-usuario', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                      body: JSON.stringify({ email: (user as any).email, nombre: `${formPerfil.nombre.trim()} ${formPerfil.apellido.trim()}` }),
                    });
                  }).catch(() => {});
                } catch {
                  alert('Error al guardar. Intentá de nuevo.');
                } finally {
                  setGuardandoPerfil(false);
                }
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Nombre</label>
                <input
                  type="text"
                  required
                  value={formPerfil.nombre}
                  onChange={e => setFormPerfil(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Tu nombre"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Apellido</label>
                <input
                  type="text"
                  required
                  value={formPerfil.apellido}
                  onChange={e => setFormPerfil(p => ({ ...p, apellido: e.target.value }))}
                  placeholder="Tu apellido"
                  className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={guardandoPerfil}
                className="w-full py-4 bg-purple-900 text-white font-black rounded-xl uppercase tracking-widest hover:bg-purple-800 transition disabled:opacity-60"
              >
                {guardandoPerfil ? 'Guardando...' : 'Solicitar Acceso'}
              </button>
            </form>
            <button onClick={logout} className="mt-5 text-gray-400 font-bold text-xs hover:underline">Cancelar / Cerrar Sesión</button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-200 max-w-md">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-4">Acceso Pendiente</h2>
          <p className="text-gray-600 mb-2 font-medium">Hola, <span className="font-black text-gray-900">{userData?.nombre} {userData?.apellido}</span>.</p>
          <p className="text-gray-600 mb-8 leading-relaxed font-medium text-base">Tu perfil está siendo validado. Te notificaremos una vez que puedas cargar fichas.</p>
          <button onClick={logout} className="text-purple-900 font-black uppercase tracking-widest text-sm hover:underline">Cerrar Sesión</button>
        </div>
      </div>
    );
  }

  const actualizarRol = async (uid: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol });
      alert('Permisos actualizados');
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

  const descargarZip = async () => {
    const conArchivo = registrosFiltrados.filter(r => r.archivoDni);
    if (conArchivo.length === 0) {
      alert('No hay archivos DNI para descargar.');
      return;
    }
    setDescargandoZip(true);
    const zip = new JSZip();
    const CONCURRENCIA = 10;
    for (let i = 0; i < conArchivo.length; i += CONCURRENCIA) {
      const lote = conArchivo.slice(i, i + CONCURRENCIA);
      await Promise.all(lote.map(async (reg) => {
        try {
          const res = await fetch(reg.archivoDni);
          const blob = await res.blob();
          const ext = blob.type === 'application/pdf' ? 'pdf' : 'jpg';
          const nombre = `${reg.apellidos}_${reg.nombres}_${reg.dni}.${ext}`.replace(/\s+/g, '_');
          zip.file(nombre, blob);
        } catch {
        }
      }));
    }
    const contenido = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(contenido);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DNIs_SIA_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDescargandoZip(false);
  };

  const exportarCSV = () => {
    if (registrosFiltrados.length === 0) {
      alert("No hay registros para exportar.");
      return;
    }

    const cabeceras = [
      "Tipo Doc", "NRO Documento", "Apellidos", "Nombres", "Sexo", "Clase", 
      "Fecha Nacimiento", "Lugar Nacimiento", "Nacionalidad", "Profesión", "Estado Civil",
      "Celular", "Mail", "Distrito", "Localidad", "Calle", "Número", "Piso", "Dpto", 
      "Observaciones", "Cargado Por", "Link DNI"
    ];

    const filas = registrosFiltrados.map(reg => [
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
      reg.archivoDni || 'Sin archivo'
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
        await updateDoc(doc(db, 'afiliaciones', editandoId), { ...formData, últimaModificación: serverTimestamp(), ...(urlDni && { archivoDni: urlDni }) });
        alert('Datos actualizados');
      } else {
        const nombreAfiliador = userData ? `${userData.apellido || ''} ${userData.nombre || ''}`.trim() : ((user as any).displayName || '');
        await addDoc(collection(db, 'afiliaciones'), { ...formData, archivoDni: urlDni, afiliadorNombre: nombreAfiliador, afiliadorEmail: (user as any).email, afiliadorUid: (user as any).uid, fecha: serverTimestamp() });
        alert('Registro exitoso');
      }

      setEditandoId(null);
      setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '' });
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
      distrito: reg.distrito || 'Buenos Aires'
    });
    setEditandoId(reg.id);
    cambiarTab('editar');
  };

  const prepararNueva = () => {
    setEditandoId(null);
    setFormData({ tipoDocumento: 'DNI', dni: '', apellidos: '', nombres: '', sexo: '', clase: '', fechaNacimiento: '', lugarNacimiento: '', nacionalidad: '', profesion: '', estadoCivil: '', celular: '', mail: '', distrito: 'Buenos Aires', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '' });
    setFotoFrenteB64(null); setFotoDorsoB64(null); setArchivoUnico(null);
    cambiarTab('nueva');
  };

  const actualizarControl = async (id: string, estado: string, extras: Record<string, any> = {}) => {
    try {
      await updateDoc(doc(db, 'afiliaciones', id), { estadoControl: estado, ...extras });
    } catch {
      alert('Error al actualizar estado.');
    }
  };

  const subirFichaEscaneada = async (id: string) => {
    if (!archivoFichaEscaneada) { alert('Seleccioná un archivo primero.'); return; }
    setSubiendoControl(true);
    const u = user as any;
    try {
      const storageRef = ref(storage, `fichas/${id}-${Date.now()}`);
      await uploadBytes(storageRef, archivoFichaEscaneada);
      const url = await getDownloadURL(storageRef);
      await actualizarControl(id, 'escaneado', {
        archivoFicha: url,
        fechaEscaneado: serverTimestamp(),
        escaneadoPor: u.displayName || u.email,
        escaneadoPorUid: u.uid,
      });
      setArchivoFichaEscaneada(null);
    } catch {
      alert('Error al subir el archivo.');
    } finally {
      setSubiendoControl(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {camaraActiva && (
        <EscanerDNI 
          titulo={camaraActiva === 'frente' ? "Escanear Frente DNI" : "Escanear Dorso DNI"}
          onClose={() => setCamaraActiva(null)} 
          onCapture={(dataUrl) => {
            if (camaraActiva === 'frente') setFotoFrenteB64(dataUrl);
            else setFotoDorsoB64(dataUrl);
            setCamaraActiva(null);
          }} 
        />
      )}

      <header className="bg-white px-6 py-4 sticky top-0 z-40 flex justify-between items-center border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
          <div>
            <h2 className="font-black text-lg md:text-2xl text-purple-950 leading-none">SIA GESTIÓN</h2>
            <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{isAdmin ? 'ADMINISTRADOR' : isSupervisor ? 'SUPERVISOR' : 'AFILIADOR'}</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <button onClick={prepararNueva} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'nueva' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Nueva Ficha</button>
          <button onClick={() => cambiarTab('registros')} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'registros' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Registros</button>
          {isAdminOrSupervisor && <button onClick={() => cambiarTab('usuarios')} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'usuarios' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Usuarios</button>}
          {isAdmin && <button onClick={() => cambiarTab('control')} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'control' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Control</button>}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button onClick={logout} className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition">Salir</button>
        </div>
        
        <button onClick={logout} className="md:hidden bg-gray-100 text-gray-900 px-3 py-2 rounded-xl text-[10px] font-black">
          SALIR
        </button>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-32 md:pb-8">
        
        {tab === 'control' && isAdmin && !fichaControlDetalle && (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">Módulo de Control</h3>
              <p className="text-sm text-gray-500 font-medium mt-1">Seguimiento del proceso de afiliación ante la JE</p>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-9 gap-2">
              {([
                { k: 'todas',      label: 'Total',      cls: 'bg-gray-900 text-white' },
                { k: 'pendiente',  label: 'Pendiente',  cls: 'bg-gray-100 text-gray-700' },
                { k: 'firmado',    label: 'Firmada',    cls: 'bg-blue-50 text-blue-700' },
                { k: 'escaneado',  label: 'Escaneada',  cls: 'bg-indigo-50 text-indigo-700' },
                { k: 'cargado_je', label: 'En JE',      cls: 'bg-amber-50 text-amber-700' },
                { k: 'aprobado',   label: 'Aprobada',   cls: 'bg-green-100 text-green-700' },
                { k: 'error',      label: 'Con Error',  cls: 'bg-red-50 text-red-700' },
                { k: 'suspendido', label: 'Suspendido', cls: 'bg-orange-50 text-orange-700' },
                { k: 'baja',       label: 'Baja',       cls: 'bg-red-100 text-red-800' },
              ] as { k: string; label: string; cls: string }[]).map(({ k, label, cls }) => (
                <button key={k} onClick={() => setFiltroControl(k)}
                  className={`p-2 rounded-xl text-center transition ${cls} ${filtroControl === k ? 'ring-2 ring-current ring-offset-1' : 'opacity-70 hover:opacity-100'}`}>
                  <div className="text-lg font-black">{k === 'todas' ? registros.length : registros.filter(r => (r.estadoControl || 'pendiente') === k).length}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest mt-0.5 leading-tight">{label}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                </div>
                <input type="text" placeholder="Buscar por DNI, Nombre o Apellido..." value={busquedaControl}
                  onChange={(e) => setBusquedaControl(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:border-purple-900 focus:ring-1 focus:ring-purple-900 font-medium text-gray-900" />
              </div>
              <div className="w-full md:w-64">
                <select value={filtroControlAfiliador} onChange={(e) => setFiltroControlAfiliador(e.target.value)}
                  className="w-full p-3 bg-white border border-gray-300 rounded-xl outline-none focus:border-purple-900 font-bold text-gray-900 cursor-pointer">
                  <option value="todas">Todos los afiliadores</option>
                  {usuariosSistema.filter(u => u.rol !== 'pendiente').map(u => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <span className="text-sm font-bold text-gray-500">{registrosControl.length} resultado{registrosControl.length !== 1 ? 's' : ''}</span>

            <div className="space-y-2">
              {registrosControl.map((reg) => {
                const estado = reg.estadoControl || 'pendiente';
                const cfg = estadoControlCfg[estado] || estadoControlCfg.pendiente;
                return (
                  <div key={reg.id} onClick={() => { setFichaControlDetalleId(reg.id); setArchivoFichaEscaneada(null); setTextoErrorJE(reg.errorJE || ''); setTextoSuspension(''); }}
                    className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 hover:border-purple-300 hover:bg-purple-50 active:scale-[0.99] transition cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-gray-900 truncate">{reg.apellidos}, {reg.nombres}</div>
                      <div className="text-sm text-gray-500 font-medium">{reg.tipoDocumento || 'DNI'} {reg.dni} · {reg.localidad} · <span className="text-gray-400">{reg.afiliadorNombre || reg.afiliadorEmail}</span></div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border ${cfg.cls}`}>{cfg.label}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </div>
                  </div>
                );
              })}
              {registrosControl.length === 0 && (
                <p className="py-20 text-center font-bold text-gray-400 text-lg">No se encontraron fichas.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'control' && isAdmin && fichaControlDetalle && (() => {
          const reg = fichaControlDetalle;
          const estado = reg.estadoControl || 'pendiente';
          const cfg = estadoControlCfg[estado] || estadoControlCfg.pendiente;
          const u = user as any;
          const userInfo = { por: u.displayName || u.email, uid: u.uid };
          const esInactivo = estado === 'suspendido' || estado === 'baja';

          const confirmarAccionInactivo = (nuevoEstado: 'suspendido' | 'baja') => {
            const label = nuevoEstado === 'suspendido' ? 'suspensión' : 'baja definitiva';
            if (!window.confirm(`¿Confirmar ${label} de este afiliado?`)) return;
            const extras: Record<string, any> = {
              estadoAnterior: estado,
              fechaSuspension: serverTimestamp(),
              suspendidoPor: userInfo.por,
              suspendidoPorUid: userInfo.uid,
              suspendidoComentario: textoSuspension.trim() || null,
            };
            actualizarControl(reg.id, nuevoEstado, extras);
            setTextoSuspension('');
            setAccionSuspension(null);
          };

          return (
            <div className="space-y-6">
              <button onClick={() => { setFichaControlDetalleId(null); setAccionSuspension(null); }} className="text-purple-900 font-bold text-sm flex items-center gap-2 hover:underline">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                Volver al listado
              </button>

              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-md border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">{reg.apellidos}, {reg.nombres}</h3>
                    <p className="text-gray-500 font-bold tracking-widest uppercase mt-1">{reg.tipoDocumento || 'DNI'}: {reg.dni}</p>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-black tracking-wide border-2 ${cfg.cls}`}>{cfg.label}</span>
                      {reg.archivoDni && (
                        <a href={reg.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                          Ver DNI
                        </a>
                      )}
                      {reg.archivoFicha && (
                        <a href={reg.archivoFicha} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                          Ver ficha
                        </a>
                      )}
                    </div>
                    {!esInactivo && (
                      <div className="flex gap-2">
                        <button onClick={() => { setAccionSuspension(accionSuspension === 'suspendido' ? null : 'suspendido'); setTextoSuspension(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border transition ${accionSuspension === 'suspendido' ? 'bg-orange-600 text-white border-orange-600' : 'border-orange-300 text-orange-600 hover:bg-orange-50'}`}>
                          Suspender
                        </button>
                        <button onClick={() => { setAccionSuspension(accionSuspension === 'baja' ? null : 'baja'); setTextoSuspension(''); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide border transition ${accionSuspension === 'baja' ? 'bg-red-800 text-white border-red-800' : 'border-red-300 text-red-700 hover:bg-red-50'}`}>
                          Dar de baja
                        </button>
                      </div>
                    )}
                    {accionSuspension && (
                      <div className="w-full md:w-72 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                        <p className="text-xs font-black text-gray-700 uppercase tracking-wide">
                          {accionSuspension === 'suspendido' ? 'Motivo de suspensión (opcional):' : 'Motivo de baja (opcional):'}
                        </p>
                        <textarea placeholder="Motivo..." value={textoSuspension} onChange={(e) => setTextoSuspension(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none resize-none focus:border-gray-400" rows={2} />
                        <div className="flex gap-2">
                          <button onClick={() => confirmarAccionInactivo(accionSuspension)}
                            className={`flex-1 py-2 text-white font-black rounded-lg text-xs uppercase transition ${accionSuspension === 'suspendido' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-800 hover:bg-red-900'}`}>
                            Confirmar
                          </button>
                          <button onClick={() => { setAccionSuspension(null); setTextoSuspension(''); }}
                            className="px-3 py-2 text-gray-600 font-black rounded-lg text-xs uppercase border border-gray-300 hover:bg-gray-100 transition">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nacimiento</p><p className="font-bold text-gray-900">{reg.fechaNacimiento}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Lugar Nac.</p><p className="font-bold text-gray-900">{reg.lugarNacimiento || '-'}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Clase</p><p className="font-bold text-gray-900">{reg.clase || '-'}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Sexo</p><p className="font-bold text-gray-900">{reg.sexo}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nacionalidad</p><p className="font-bold text-gray-900">{reg.nacionalidad}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Profesión</p><p className="font-bold text-gray-900">{reg.profesion || '-'}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Estado Civil</p><p className="font-bold text-gray-900">{reg.estadoCivil || '-'}</p></div>
                  <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Localidad</p><p className="font-bold text-gray-900">{reg.localidad}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Celular</p><p className="font-bold text-gray-900">{reg.celular || '-'}</p></div>
                  <div className="col-span-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Email</p><p className="font-bold text-gray-900">{reg.mail || '-'}</p></div>
                  <div className="col-span-2 md:col-span-4"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Dirección</p><p className="font-bold text-gray-900">{reg.calle} {reg.numero}{reg.piso ? `, Piso ${reg.piso}` : ''}{reg.dpto ? ` Dpto ${reg.dpto}` : ''}, {reg.localidad}</p></div>
                  {reg.observaciones && <div className="col-span-2 md:col-span-4"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Observaciones</p><p className="font-medium text-gray-800 bg-gray-50 p-3 rounded-lg mt-1 border border-gray-100">{reg.observaciones}</p></div>}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-sm mb-4">Historial</h4>
                <div className="space-y-3">
                  {([
                    { show: true,                     dot: 'bg-green-500', label: 'Cargado digitalmente',  por: reg.afiliadorNombre || reg.afiliadorEmail, ts: reg.fecha },
                    { show: !!reg.firmadoPor,          dot: 'bg-green-500', label: 'Ficha firmada recibida', por: reg.firmadoPor,    ts: reg.fechaFirma },
                    { show: !!reg.escaneadoPor,        dot: 'bg-green-500', label: 'Escaneada y subida',    por: reg.escaneadoPor,  ts: reg.fechaEscaneado },
                    { show: !!reg.cargadoJEPor,        dot: 'bg-green-500', label: 'Cargada en JE',        por: reg.cargadoJEPor,  ts: reg.fechaCargadoJE },
                    { show: !!reg.resueltoJEPor && estado === 'aprobado', dot: 'bg-green-500', label: 'Aprobada por JE', por: reg.resueltoJEPor, ts: reg.fechaAprobacion },
                    { show: !!reg.resueltoJEPor && (estado === 'error' || !!reg.fechaError), dot: 'bg-red-400', label: 'Error JE', por: reg.resueltoJEPor, ts: reg.fechaError, extra: reg.errorJE },
                    { show: !!reg.reactivadoPor,       dot: 'bg-blue-400', label: 'Reactivado',             por: reg.reactivadoPor, ts: reg.fechaReactivacion },
                    { show: estado === 'suspendido',   dot: 'bg-orange-400', label: 'Suspendido',           por: reg.suspendidoPor, ts: reg.fechaSuspension, extra: reg.suspendidoComentario },
                    { show: estado === 'baja',         dot: 'bg-red-700',  label: 'Dado de baja',           por: reg.suspendidoPor, ts: reg.fechaSuspension, extra: reg.suspendidoComentario },
                  ] as { show: boolean; dot: string; label: string; por?: string; ts?: any; extra?: string }[]).filter(i => i.show).map((item, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.dot}`}></div>
                      <div>
                        <span className="font-black text-gray-900 text-sm">{item.label}</span>
                        {item.por && <span className="text-gray-500 text-sm font-medium"> — {item.por}{item.ts ? ` · ${fmtTs(item.ts)}` : ''}</span>}
                        {item.extra && <p className="text-xs text-gray-500 font-medium mt-0.5 italic">"{item.extra}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 space-y-4">
                <h4 className="font-black text-gray-900 uppercase tracking-widest text-sm">Acciones</h4>

                {estado === 'pendiente' && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 font-medium">La ficha física fue impresa, firmada por el afiliado y el apoderado, y fue recibida en la sede.</p>
                    <button onClick={() => actualizarControl(reg.id, 'firmado', { fechaFirma: serverTimestamp(), firmadoPor: userInfo.por, firmadoPorUid: userInfo.uid })}
                      className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition uppercase tracking-wide text-sm">
                      Marcar ficha como recibida y firmada
                    </button>
                  </div>
                )}

                {estado === 'firmado' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 font-medium">Subí el escaneado de la ficha firmada. Una vez subida podrás cargarla en la JE.</p>
                    <label className="block cursor-pointer">
                      <div className={`w-full p-4 border-2 border-dashed rounded-xl text-center transition ${archivoFichaEscaneada ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                        {archivoFichaEscaneada ? <span className="font-bold text-green-700 text-sm">{archivoFichaEscaneada.name}</span> : <span className="text-gray-500 text-sm font-medium">Seleccionar archivo (PDF o imagen)...</span>}
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setArchivoFichaEscaneada(e.target.files?.[0] || null)} />
                      </div>
                    </label>
                    <button onClick={() => subirFichaEscaneada(reg.id)} disabled={subiendoControl || !archivoFichaEscaneada}
                      className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition uppercase tracking-wide text-sm">
                      {subiendoControl ? 'Subiendo...' : 'Subir escaneado'}
                    </button>
                  </div>
                )}

                {estado === 'escaneado' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 font-medium">La ficha escaneada está disponible. Marcala como cargada una vez que la hayas ingresado en la web de la JE.</p>
                    <button onClick={() => actualizarControl(reg.id, 'cargado_je', { fechaCargadoJE: serverTimestamp(), cargadoJEPor: userInfo.por, cargadoJEPorUid: userInfo.uid })}
                      className="w-full py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition uppercase tracking-wide text-sm">
                      Marcar como cargada en la JE
                    </button>
                  </div>
                )}

                {estado === 'cargado_je' && (
                  <div className="space-y-4">
                    <button onClick={() => actualizarControl(reg.id, 'aprobado', { fechaAprobacion: serverTimestamp(), resueltoJEPor: userInfo.por, resueltoJEPorUid: userInfo.uid })}
                      className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition uppercase tracking-wide text-sm">
                      Marcar como Aprobada por JE
                    </button>
                    <div className="space-y-2 pt-3 border-t border-gray-200">
                      <p className="text-sm font-bold text-gray-700">Registrar error de la JE:</p>
                      <textarea placeholder="Describir el error recibido..." value={textoErrorJE} onChange={(e) => setTextoErrorJE(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm text-gray-900 font-medium focus:border-red-400 outline-none resize-none" rows={2} />
                      <button onClick={() => { if (!textoErrorJE.trim()) { alert('Describí el error antes de confirmar.'); return; } actualizarControl(reg.id, 'error', { errorJE: textoErrorJE.trim(), fechaError: serverTimestamp(), resueltoJEPor: userInfo.por, resueltoJEPorUid: userInfo.uid }); }}
                        className="w-full py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition uppercase tracking-wide text-sm">
                        Registrar Error JE
                      </button>
                    </div>
                  </div>
                )}

                {estado === 'aprobado' && (
                  <div className="flex items-center gap-2 text-green-700 p-3 bg-green-50 rounded-xl border border-green-200">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    <span className="font-black text-sm">Afiliación aprobada por la JE</span>
                  </div>
                )}

                {estado === 'error' && (
                  <div className="space-y-3">
                    {reg.errorJE && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-xs font-black text-red-700 uppercase tracking-wide mb-1">Error registrado:</p><p className="text-sm text-red-800 font-medium">{reg.errorJE}</p></div>}
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-gray-700">Actualizar descripción del error:</p>
                      <textarea value={textoErrorJE} onChange={(e) => setTextoErrorJE(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm text-gray-900 font-medium focus:border-red-400 outline-none resize-none" rows={2} />
                      <button onClick={() => { if (!textoErrorJE.trim()) return; actualizarControl(reg.id, 'error', { errorJE: textoErrorJE.trim() }); }}
                        className="w-full py-2 bg-gray-800 text-white font-black rounded-xl hover:bg-black transition text-sm">
                        Actualizar Error
                      </button>
                    </div>
                    <button onClick={() => actualizarControl(reg.id, 'cargado_je', {})}
                      className="w-full py-3 bg-amber-500 text-white font-black rounded-xl hover:bg-amber-600 transition uppercase tracking-wide text-sm">
                      Volver a "En JE" (reintentar)
                    </button>
                  </div>
                )}

                {estado === 'suspendido' && (
                  <div className="space-y-3">
                    {reg.suspendidoComentario && <div className="bg-orange-50 border border-orange-200 rounded-xl p-3"><p className="text-xs font-black text-orange-700 uppercase tracking-wide mb-1">Motivo:</p><p className="text-sm text-orange-800 font-medium">{reg.suspendidoComentario}</p></div>}
                    <p className="text-sm text-gray-500 font-medium">El afiliado está suspendido temporalmente. Podés reactivarlo para retomar el proceso.</p>
                    <button onClick={() => actualizarControl(reg.id, reg.estadoAnterior || 'pendiente', { fechaReactivacion: serverTimestamp(), reactivadoPor: userInfo.por, reactivadoPorUid: userInfo.uid, suspendidoPor: null, fechaSuspension: null, suspendidoComentario: null, estadoAnterior: null })}
                      className="w-full py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition uppercase tracking-wide text-sm">
                      Reactivar afiliado
                    </button>
                  </div>
                )}

                {estado === 'baja' && (
                  <div className="space-y-3">
                    {reg.suspendidoComentario && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-xs font-black text-red-800 uppercase tracking-wide mb-1">Motivo de baja:</p><p className="text-sm text-red-900 font-medium">{reg.suspendidoComentario}</p></div>}
                    <p className="text-sm text-gray-500 font-medium">El afiliado fue dado de baja. Esta acción es definitiva, pero puede revertirse si fuera necesario.</p>
                    <button onClick={() => { if (!window.confirm('¿Revertir la baja y reactivar este afiliado?')) return; actualizarControl(reg.id, reg.estadoAnterior || 'pendiente', { fechaReactivacion: serverTimestamp(), reactivadoPor: userInfo.por, reactivadoPorUid: userInfo.uid, suspendidoPor: null, fechaSuspension: null, suspendidoComentario: null, estadoAnterior: null }); }}
                      className="w-full py-3 bg-gray-700 text-white font-black rounded-xl hover:bg-black transition uppercase tracking-wide text-sm">
                      Revertir baja
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* PESTAÑA: USUARIOS */}
        {tab === 'usuarios' && isAdminOrSupervisor && (
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
                        {editandoUsuarioId === u.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              value={formEditUsuario.nombre}
                              onChange={e => setFormEditUsuario(p => ({ ...p, nombre: e.target.value }))}
                              placeholder="Nombre"
                              className="p-2 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:border-purple-900"
                            />
                            <input
                              value={formEditUsuario.apellido}
                              onChange={e => setFormEditUsuario(p => ({ ...p, apellido: e.target.value }))}
                              placeholder="Apellido"
                              className="p-2 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:border-purple-900"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="font-bold text-gray-900">
                              {[u.apellido, u.nombre].filter(Boolean).join(', ') || <span className="text-gray-400 italic font-normal text-sm">Sin nombre</span>}
                            </div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                          </>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase ${u.rol === 'admin' ? 'bg-purple-900 text-white' : u.rol === 'supervisor' ? 'bg-blue-700 text-white' : u.rol === 'afiliador' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4">
                        {editandoUsuarioId === u.id ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={guardarNombreUsuario} className="bg-green-600 text-white text-xs font-black px-4 py-2 rounded-lg hover:bg-green-700">GUARDAR</button>
                            <button onClick={() => setEditandoUsuarioId(null)} className="bg-gray-200 text-gray-700 text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-300">CANCELAR</button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2 flex-wrap">
                            {(isAdmin || (isSupervisor && u.rol !== 'admin' && u.rol !== 'supervisor')) && (
                              <button
                                onClick={() => { setEditandoUsuarioId(u.id); setFormEditUsuario({ nombre: u.nombre || '', apellido: u.apellido || '' }); }}
                                className="border border-gray-300 text-gray-600 text-xs font-black px-3 py-2 rounded-lg hover:bg-gray-50"
                              >
                                EDITAR
                              </button>
                            )}
                            {(isAdmin ? u.rol !== 'afiliador' : u.rol === 'pendiente') && (
                              <button onClick={() => actualizarRol(u.id, 'afiliador')} className="bg-black text-white text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-800">AUTORIZAR</button>
                            )}
                            {isAdmin && u.rol !== 'supervisor' && u.id !== (user as any).uid && (
                              <button onClick={() => actualizarRol(u.id, 'supervisor')} className="border-2 border-blue-700 text-blue-700 text-xs font-black px-4 py-2 rounded-lg hover:bg-blue-50">SUPERVISOR</button>
                            )}
                            {isAdmin && u.rol !== 'admin' && u.id !== (user as any).uid && (
                              <button onClick={() => actualizarRol(u.id, 'admin')} className="border-2 border-black text-black text-xs font-black px-4 py-2 rounded-lg hover:bg-gray-100">ADMIN</button>
                            )}
                            {isAdmin && u.rol !== 'admin' && u.rol !== 'pendiente' && u.id !== (user as any).uid && (
                              <button onClick={() => { if (window.confirm(`¿Revocar acceso de ${u.nombre || u.email}? Quedará como pendiente.`)) actualizarRol(u.id, 'pendiente'); }} className="border-2 border-red-500 text-red-600 text-xs font-black px-4 py-2 rounded-lg hover:bg-red-50">REVOCAR</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'detalle' && fichaSeleccionada && (
          <div className="bg-white p-6 md:p-10 rounded-2xl shadow-md border border-gray-200">
            <button onClick={() => cambiarTab('registros')} className="text-purple-900 mb-6 font-bold text-sm flex items-center gap-2 hover:underline">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              Volver a Fichas
            </button>
            
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-8 border-b border-gray-100 pb-6">
              <div>
                <h3 className="text-3xl font-black text-gray-900 leading-tight">{fichaSeleccionada.apellidos}, {fichaSeleccionada.nombres}</h3>
                <p className="text-gray-500 font-bold tracking-widest uppercase mt-1">{fichaSeleccionada.tipoDocumento || 'DNI'}: {fichaSeleccionada.dni}</p>
              </div>
              
              {fichaSeleccionada.archivoDni && (
                <a href={fichaSeleccionada.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-red-50 text-red-700 border-2 border-red-200 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-sm hover:bg-red-100 active:scale-95 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                  Ver DNI
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nacimiento</p><p className="font-bold text-gray-900">{fichaSeleccionada.fechaNacimiento}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Lugar Nac.</p><p className="font-bold text-gray-900">{fichaSeleccionada.lugarNacimiento || '-'}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Clase (Año)</p><p className="font-bold text-gray-900">{fichaSeleccionada.clase || '-'}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Sexo</p><p className="font-bold text-gray-900">{fichaSeleccionada.sexo}</p></div>
              
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Nacionalidad</p><p className="font-bold text-gray-900">{fichaSeleccionada.nacionalidad}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Profesión</p><p className="font-bold text-gray-900">{fichaSeleccionada.profesion || '-'}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Estado Civil</p><p className="font-bold text-gray-900">{fichaSeleccionada.estadoCivil || '-'}</p></div>
              <div><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Localidad</p><p className="font-bold text-gray-900">{fichaSeleccionada.localidad}</p></div>
              
              <div className="col-span-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Celular</p><p className="font-bold text-gray-900">{fichaSeleccionada.celular || '-'}</p></div>
              <div className="col-span-2"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Email</p><p className="font-bold text-gray-900">{fichaSeleccionada.mail || '-'}</p></div>

              <div className="col-span-2 md:col-span-4"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Dirección ({fichaSeleccionada.distrito || 'Buenos Aires'})</p><p className="font-bold text-gray-900">{fichaSeleccionada.calle} {fichaSeleccionada.numero} {fichaSeleccionada.piso ? `Piso ${fichaSeleccionada.piso}` : ''} {fichaSeleccionada.dpto ? `Dpto ${fichaSeleccionada.dpto}` : ''}</p></div>
              
              {fichaSeleccionada.observaciones && (
                <div className="col-span-2 md:col-span-4"><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Observaciones</p><p className="font-medium text-gray-800 bg-gray-50 p-3 rounded-lg mt-1 border border-gray-100">{fichaSeleccionada.observaciones}</p></div>
              )}
            </div>

            <button onClick={() => prepararEdicion(fichaSeleccionada)} className="w-full py-5 bg-purple-100 text-purple-900 border-2 border-purple-200 rounded-2xl font-black uppercase tracking-widest hover:bg-purple-200 transition flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
              Editar Datos
            </button>
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
                <h4 className="text-base font-black text-gray-900 uppercase tracking-wide">Documentación DNI</h4>
                <div className="flex bg-gray-100 p-2 rounded-xl max-w-sm">
                  <button type="button" onClick={() => setModoArchivo('escaner')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase tracking-wider ${modoArchivo === 'escaner' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Escaner</button>
                  <button type="button" onClick={() => setModoArchivo('unico')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase tracking-wider ${modoArchivo === 'unico' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Archivo Local</button>
                </div>
                
                {modoArchivo === 'escaner' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-sm font-bold text-gray-900 mb-4 uppercase">{fotoFrenteB64 ? 'FRENTE CAPTURADO' : 'TOMAR FRENTE'}</span>
                      <button type="button" onClick={() => setCamaraActiva('frente')} className={`w-full h-24 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoFrenteB64 ? { backgroundImage: `url(${fotoFrenteB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoFrenteB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoFrenteB64 && <button type="button" onClick={() => setFotoFrenteB64(null)} className="text-red-500 text-xs font-bold mt-2 uppercase hover:underline">Borrar</button>}
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-sm font-bold text-gray-900 mb-4 uppercase">{fotoDorsoB64 ? 'DORSO CAPTURADO' : 'TOMAR DORSO'}</span>
                      <button type="button" onClick={() => setCamaraActiva('dorso')} className={`w-full h-24 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoDorsoB64 ? { backgroundImage: `url(${fotoDorsoB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoDorsoB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoDorsoB64 && <button type="button" onClick={() => setFotoDorsoB64(null)} className="text-red-500 text-xs font-bold mt-2 uppercase hover:underline">Borrar</button>}
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
                <input 
                  type="text" 
                  placeholder="Buscar por DNI, Nombre o Apellido..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:border-purple-900 focus:ring-1 focus:ring-purple-900 font-medium text-gray-900"
                />
              </div>

              {isAdminOrSupervisor && (
                <div className="w-full md:w-64">
                  <select
                    value={filtroAfiliador}
                    onChange={(e) => setFiltroAfiliador(e.target.value)}
                    className="w-full p-3 bg-white border border-gray-300 rounded-xl outline-none focus:border-purple-900 font-bold text-gray-900 cursor-pointer"
                  >
                    <option value="todas">Todos los afiliadores</option>
                    {usuariosSistema.filter(u => u.rol !== 'pendiente').map(u => (
                      <option key={u.id} value={u.id}>{[u.apellido, u.nombre].filter(Boolean).join(', ') || u.email}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 mb-4">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Listado</h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-purple-100 text-purple-900 px-4 py-2 rounded-lg font-black text-sm border border-purple-200">
                  Resultados: {registrosFiltrados.length}
                </div>
                {isAdminOrSupervisor && (
                  <div className="flex items-center gap-2">
                    <button onClick={exportarCSV} className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg font-black text-sm border border-green-200 hover:bg-green-100 transition active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                      Exportar CSV
                    </button>
                    <button onClick={descargarZip} disabled={descargandoZip} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-black text-sm border border-blue-200 hover:bg-blue-100 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                      {descargandoZip ? 'Generando ZIP...' : 'Descargar DNIs (ZIP)'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {registrosFiltrados.map((reg) => (
                <div 
                  key={reg.id} 
                  onClick={() => { setFichaSeleccionada(reg); cambiarTab('detalle'); }} 
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center hover:border-purple-300 hover:bg-purple-50 active:scale-[0.98] transition cursor-pointer"
                >
                  <div>
                    <div className="text-lg font-black text-gray-900 leading-tight">{reg.dni}</div>
                    <div className="text-xs font-bold text-gray-500 uppercase mt-0.5">{reg.apellidos}, {reg.nombres}</div>
                  </div>
                  <div className="text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
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

            {isAdminOrSupervisor && (
              <button onClick={() => cambiarTab('usuarios')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'usuarios' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
                <IconUsuarios />
                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Usuarios</span>
              </button>
            )}
            {isAdmin && (
              <button onClick={() => cambiarTab('control')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'control' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
                <IconControl />
                <span className="text-[10px] font-black uppercase tracking-widest mt-1">Control</span>
              </button>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}