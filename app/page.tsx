'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ref, uploadString, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';

// --- ICONOS ---
const IconNueva = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const IconFichas = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const IconUsuarios = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;

// --- COMPONENTE DE CÁMARA INTEGRADA (ESCANER) ---
const EscanerDNI = ({ onClose, onCapture, titulo }: { onClose: () => void, onCapture: (imgData: string) => void, titulo: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marcoRef = useRef<HTMLDivElement>(null);

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

    // Factores de escala entre el tamaño real del video y el tamaño en pantalla
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    // Calcular coordenadas del recorte (con un 10% extra de margen)
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
      onCapture(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="p-4 bg-black text-white flex justify-between items-center z-10">
        <h3 className="font-bold text-lg">{titulo}</h3>
        <button onClick={onClose} className="text-white font-bold px-3 py-1 bg-red-600 rounded">Cerrar</button>
      </div>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* El video llena todo pero recorta lo que sobra para mantener proporción */}
        <video ref={videoRef} autoPlay playsInline className="absolute w-full h-full object-cover" />
        
        {/* Capa de oscurecimiento con "agujero" simulado */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none"></div>
        
        {/* Marco guía (Relación de aspecto DNI aprox 1.58) */}
        <div 
          ref={marcoRef} 
          className="relative w-[85%] aspect-[1.58] border-4 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none"
        >
          {/* Esquinas animadas para diseño */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
          
          <p className="absolute inset-0 flex items-center justify-center text-white/50 font-bold text-lg uppercase tracking-widest">Alinee el DNI aquí</p>
        </div>
      </div>
      <div className="h-32 bg-black flex items-center justify-center pb-8 z-10">
        <button onClick={tomarFoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 active:bg-gray-200 transition shadow-[0_0_15px_rgba(255,255,255,0.5)]"></button>
      </div>
    </div>
  );
};

// --- APLICACIÓN PRINCIPAL ---
export default function Home() {
  const { user, loading, role, isAdmin, loginConGoogle, logout } = useAuth();
  const [tab, setTab] = useState<'nueva' | 'registros' | 'usuarios'>('nueva');
  const [formData, setFormData] = useState({
    apellidos: '', nombres: '', dni: '', sexo: '',
    nacionalidad: '', fechaNacimiento: '',
    distrito: 'San Isidro', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: ''
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  // Estados para cámara y fotos
  const [modoArchivo, setModoArchivo] = useState<'escaner' | 'unico'>('escaner');
  const [camaraActiva, setCamaraActiva] = useState<null | 'frente' | 'dorso'>(null);
  const [fotoFrenteB64, setFotoFrenteB64] = useState<string | null>(null);
  const [fotoDorsoB64, setFotoDorsoB64] = useState<string | null>(null);
  const [archivoUnico, setArchivoUnico] = useState<File | null>(null);
  
  const [subiendo, setSubiendo] = useState(false);

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
    try {
      await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol });
      alert('Permisos actualizados');
    } catch (e) {
      alert('Error de red');
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
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const procesarDNIUnicoPdf = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const anchoMax = pdf.internal.pageSize.getWidth() - 20;

    // Helper para cargar base64 en Image object para calcular proporciones
    const getImgObj = (b64: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = b64;
      });
    };

    const imgF = await getImgObj(fotoFrenteB64!);
    const imgD = await getImgObj(fotoDorsoB64!);

    const altoF = anchoMax * (imgF.height / imgF.width);
    const altoD = anchoMax * (imgD.height / imgD.width);

    // Agregamos frente arriba y dorso abajo
    pdf.addImage(fotoFrenteB64!, 'JPEG', 10, 10, anchoMax, altoF);
    pdf.addImage(fotoDorsoB64!, 'JPEG', 10, 20 + altoF, anchoMax, altoD);
    
    return pdf.output('blob');
  };

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubiendo(true);

    try {
      let urlDni = '';
      if (!editandoId || fotoFrenteB64 || archivoUnico) {
        const timestamp = Date.now();
        const ruta = `dnis/${formData.dni}-${timestamp}.pdf`;
        const storageRef = ref(storage, ruta);

        if (modoArchivo === 'escaner' && fotoFrenteB64 && fotoDorsoB64) {
          const blob = await procesarDNIUnicoPdf();
          await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
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
        await addDoc(collection(db, 'afiliaciones'), { ...formData, archivoDni: urlDni, afiliadorNombre: (user as any).displayName || '', afiliadorEmail: (user as any).email, afiliadorUid: (user as any).uid, fecha: serverTimestamp() });
        alert('Registro exitoso');
      }

      setEditandoId(null);
      setTab('registros');
      setFormData({ apellidos: '', nombres: '', dni: '', sexo: '', nacionalidad: '', fechaNacimiento: '', distrito: 'San Isidro', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '' });
      setFotoFrenteB64(null); setFotoDorsoB64(null); setArchivoUnico(null);
    } catch (error) {
      alert('Error al guardar en la base de datos.');
    } finally {
      setSubiendo(false);
    }
  };

  const prepararEdicion = (reg: any) => {
    setFormData({ ...reg });
    setEditandoId(reg.id);
    setTab('nueva');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* RENDERIZADO DEL MODAL DE LA CÁMARA */}
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
          <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div>
            <h2 className="font-black text-xl md:text-2xl text-purple-950 leading-none">SIA GESTIÓN</h2>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{isAdmin ? 'ADMINISTRADOR' : 'AFILIADOR'}</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <button onClick={() => { setTab('nueva'); setEditandoId(null); }} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'nueva' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Nueva Ficha</button>
          <button onClick={() => setTab('registros')} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'registros' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Registros</button>
          {isAdmin && <button onClick={() => setTab('usuarios')} className={`px-4 py-2 rounded-lg font-bold transition ${tab === 'usuarios' ? 'bg-purple-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Usuarios</button>}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button onClick={logout} className="text-red-600 font-bold hover:bg-red-50 px-4 py-2 rounded-lg transition">Salir</button>
        </div>
        
        <button onClick={logout} className="md:hidden bg-gray-100 text-gray-900 px-4 py-2 rounded-xl text-xs font-black">
          SALIR
        </button>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-32 md:pb-8">
        
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

        {tab === 'nueva' && (
          <form onSubmit={guardarFicha} className="space-y-6 bg-white p-6 md:p-10 rounded-2xl shadow-md border border-gray-200">
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight border-b border-gray-100 pb-4">
              {editandoId ? 'Editando Registro' : 'Nueva Ficha de Afiliación'}
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
              
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">DNI (Matrícula)</label>
                <input type="number" inputMode="numeric" pattern="[0-9]*" name="dni" value={formData.dni} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-bold focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
              </div>
              
              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Sexo</label>
                <select name="sexo" value={formData.sexo} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required>
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Nacionalidad</label>
                <input type="text" name="nacionalidad" value={formData.nacionalidad} onChange={handleChange} className="w-full p-3 md:p-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-900 focus:ring-1 focus:ring-purple-900 outline-none transition text-base" required />
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
            </div>

            <div className="bg-purple-950 p-6 md:p-8 rounded-2xl text-white space-y-6 shadow-md mt-8">
               <h4 className="text-sm md:text-base font-black uppercase tracking-widest border-b border-purple-800 pb-4">Ubicación del Domicilio</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-xs font-bold text-purple-300 uppercase mb-2">Distrito</label>
                   <input type="text" value="San Isidro" readOnly className="w-full p-3 md:p-4 bg-purple-900/50 border border-purple-700 rounded-xl text-white font-bold cursor-not-allowed outline-none text-base" />
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
                     <input type="number" inputMode="numeric" pattern="[0-9]*" name="piso" value={formData.piso} onChange={handleChange} className="w-full p-3 md:p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none text-base" />
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

            {/* SECCIÓN DOCUMENTACIÓN ACTUALIZADA */}
            {!editandoId && (
              <div className="space-y-6 pt-6 border-t border-gray-200 mt-8">
                <h4 className="text-base font-black text-gray-900 uppercase tracking-wide">Documentación DNI</h4>
                <div className="flex bg-gray-100 p-2 rounded-xl max-w-sm">
                  <button type="button" onClick={() => setModoArchivo('escaner')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase ${modoArchivo === 'escaner' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Cámara / Escaner</button>
                  <button type="button" onClick={() => setModoArchivo('unico')} className={`flex-1 py-3 rounded-lg text-sm font-black transition uppercase ${modoArchivo === 'unico' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-500 hover:text-gray-700'}`}>Archivo Local</button>
                </div>
                
                {modoArchivo === 'escaner' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-sm font-bold text-gray-900 mb-4 uppercase">{fotoFrenteB64 ? 'FRENTE CAPTURADO' : 'TOMAR FRENTE'}</span>
                      <button type="button" onClick={() => setCamaraActiva('frente')} className={`w-full h-24 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoFrenteB64 ? { backgroundImage: `url(${fotoFrenteB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoFrenteB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoFrenteB64 && <button type="button" onClick={() => setFotoFrenteB64(null)} className="text-red-500 text-xs font-bold mt-2 uppercase">Borrar</button>}
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 bg-gray-50 text-center hover:bg-gray-100 transition">
                      <span className="block text-sm font-bold text-gray-900 mb-4 uppercase">{fotoDorsoB64 ? 'DORSO CAPTURADO' : 'TOMAR DORSO'}</span>
                      <button type="button" onClick={() => setCamaraActiva('dorso')} className={`w-full h-24 rounded-xl flex items-center justify-center border-2 border-gray-300 bg-white shadow-sm hover:shadow-md transition bg-center bg-cover bg-no-repeat`} style={fotoDorsoB64 ? { backgroundImage: `url(${fotoDorsoB64})`, borderColor: '#22c55e' } : {}}>
                        {!fotoDorsoB64 && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-purple-900"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>}
                      </button>
                      {fotoDorsoB64 && <button type="button" onClick={() => setFotoDorsoB64(null)} className="text-red-500 text-xs font-bold mt-2 uppercase">Borrar</button>}
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
          <div className="space-y-6">
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Afiliados Registrados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registros.map((reg) => (
                <div key={reg.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center hover:shadow-md transition gap-4">
                  <div>
                    <div className="text-xl font-black text-gray-900">{reg.dni}</div>
                    <div className="text-sm font-bold text-gray-500 uppercase mt-1">{reg.apellidos}, {reg.nombres}</div>
                    <button onClick={() => prepararEdicion(reg)} className="mt-4 text-purple-900 font-bold text-sm uppercase tracking-wide hover:underline flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                      Editar Datos
                    </button>
                  </div>
                  <div className="sm:text-right">
                    {reg.archivoDni && (
                      <a href={reg.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-block bg-gray-900 text-white font-bold px-6 py-3 rounded-xl text-sm uppercase tracking-wider hover:bg-black transition">
                        VER DNI
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {registros.length === 0 && <p className="py-20 text-center font-bold text-gray-400 text-lg">No hay registros cargados aún.</p>}
          </div>
        )}
      </main>

      <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
        <nav className="bg-white/80 backdrop-blur-xl border border-gray-200 shadow-xl flex gap-2 p-2 rounded-[2rem] w-full max-w-sm">
          <button onClick={() => { setTab('nueva'); setEditandoId(null); }} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'nueva' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
            <IconNueva />
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Nueva</span>
          </button>
          
          <button onClick={() => setTab('registros')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'registros' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
            <IconFichas />
            <span className="text-[10px] font-black uppercase tracking-widest mt-1">Fichas</span>
          </button>

          {isAdmin && (
            <button onClick={() => setTab('usuarios')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[1.5rem] transition ${tab === 'usuarios' ? 'bg-purple-900 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}>
              <IconUsuarios />
              <span className="text-[10px] font-black uppercase tracking-widest mt-1">Usuarios</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}