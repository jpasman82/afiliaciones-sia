'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';

// Iconos SVG Progresivos
const IconNueva = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>;
const IconFichas = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75c.621 0 1.125.504 1.125 1.125v1.875c0 .621-.504 1.125-1.125 1.125H5.625a1.125 1.125 0 0 1-1.125-1.125V5.625c0-.621.504-1.125 1.125-1.125Z" /></svg>;
const IconUsuarios = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;

export default function Home() {
  const { user, loading, role, isAdmin, loginConGoogle, logout } = useAuth();
  const [tab, setTab] = useState<'nueva' | 'registros' | 'usuarios'>('nueva');
  const [formData, setFormData] = useState({
    apellidos: '', nombres: '', dni: '', sexo: '',
    nacionalidad: '', fechaNacimiento: '', estadoCivil: '',
    distrito: 'San Isidro', calle: '', numero: '', piso: '', dpto: '',
    localidad: '', observaciones: ''
  });
  
  const [registros, setRegistros] = useState<any[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<any[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [modoArchivo, setModoArchivo] = useState<'separado' | 'unico'>('separado');
  const [fotoFrente, setFotoFrente] = useState<File | null>(null);
  const [fotoDorso, setFotoDorso] = useState<File | null>(null);
  const [archivoUnico, setArchivoUnico] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    if (!user || role === 'pendiente') return;
    const q = isAdmin 
      ? query(collection(db, 'afiliaciones'), orderBy('fecha', 'desc'))
      : query(collection(db, 'afiliaciones'), where('afiliadorUid', '==', (user as any).uid));

    return onSnapshot(q, (snapshot) => {
      setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [user, isAdmin, role]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'usuarios'), orderBy('fechaRegistro', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setUsuariosSistema(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [isAdmin]);

  if (loading) return <div className="p-10 text-center font-bold text-gray-900">Iniciando SIA...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4 text-gray-900">
        <img src="/logo.png" alt="SIA Logo" className="w-32 h-32 mb-6" />
        <h1 className="text-4xl font-black mb-8 tracking-tighter">SIA GESTIÓN</h1>
        <button onClick={loginConGoogle} className="bg-purple-900 text-white font-bold px-10 py-4 rounded-2xl shadow-xl flex items-center gap-3 active:scale-95 transition">
          Ingresar con Gmail
        </button>
      </div>
    );
  }

  if (role === 'pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-sm">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Acceso Pendiente</h2>
          <p className="text-gray-600 mb-8 leading-relaxed font-medium">Tu perfil de administrador está siendo validado. Te notificaremos una vez que puedas cargar fichas.</p>
          <button onClick={logout} className="text-purple-900 font-black uppercase tracking-widest text-xs">Cerrar Sesión</button>
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const procesarImagen = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const guardarFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubiendo(true);

    try {
      let urlDni = '';
      if (!editandoId || fotoFrente || archivoUnico) {
        if (modoArchivo === 'separado' && fotoFrente && fotoDorso) {
          const pdf = new jsPDF('p', 'mm', 'a4');
          const imgF = await procesarImagen(fotoFrente);
          const imgD = await procesarImagen(fotoDorso);
          const anchoMax = pdf.internal.pageSize.getWidth() - 20;
          const altoF = anchoMax * (imgF.height / imgF.width);
          const altoD = anchoMax * (imgD.height / imgD.width);
          pdf.addImage(imgF, 'JPEG', 10, 10, anchoMax, altoF);
          pdf.addImage(imgD, 'JPEG', 10, 20 + altoF, anchoMax, altoD);
          const blob = pdf.output('blob');
          const storageRef = ref(storage, `dnis/${formData.dni}-${Date.now()}.pdf`);
          await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
          urlDni = await getDownloadURL(storageRef);
        } else if (archivoUnico) {
          const storageRef = ref(storage, `dnis/${formData.dni}-${Date.now()}`);
          await uploadBytes(storageRef, archivoUnico);
          urlDni = await getDownloadURL(storageRef);
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
      setFormData({ apellidos: '', nombres: '', dni: '', sexo: '', nacionalidad: '', fechaNacimiento: '', estadoCivil: '', distrito: 'San Isidro', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '' });
      setFotoFrente(null); setFotoDorso(null); setArchivoUnico(null);
    } catch (error) {
      alert('Error en el envío');
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
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Header Premium */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40 flex justify-between items-center border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h2 className="font-black text-lg text-purple-950 leading-none">SIA GESTIÓN</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{isAdmin ? 'ADMIN PANEL' : 'AFILIADOR'}</p>
          </div>
        </div>
        <button onClick={logout} className="bg-gray-100 text-gray-900 px-4 py-2 rounded-xl text-xs font-black hover:bg-gray-200 transition">
          SALIR
        </button>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-6 pb-32">
        
        {tab === 'usuarios' && isAdmin && (
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100"><h3 className="font-black text-gray-900">Control de Accesos</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-5 font-black text-gray-950 uppercase text-[10px]">Identidad</th>
                    <th className="p-5 font-black text-gray-950 uppercase text-[10px]">Rol</th>
                    <th className="p-5 text-right font-black text-gray-950 uppercase text-[10px]">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosSistema.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50">
                      <td className="p-5">
                        <div className="font-bold text-gray-900">{u.nombre}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase ${u.rol === 'admin' ? 'bg-purple-900 text-white' : u.rol === 'afiliador' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-5 text-right flex justify-end gap-2">
                        {u.rol !== 'afiliador' && <button onClick={() => actualizarRol(u.id, 'afiliador')} className="bg-black text-white text-[9px] font-black px-3 py-2 rounded-lg">AUTORIZAR</button>}
                        {u.rol !== 'admin' && u.email !== (user as any).email && <button onClick={() => actualizarRol(u.id, 'admin')} className="border-2 border-black text-black text-[9px] font-black px-3 py-2 rounded-lg">ADMIN</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'nueva' && (
          <form onSubmit={guardarFicha} className="space-y-8 bg-white">
            <h3 className="text-2xl font-black text-gray-950 tracking-tight">
              {editandoId ? 'Editando Registro' : 'Nueva Ficha de Afiliación'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: 'Apellidos', name: 'apellidos', type: 'text' },
                { label: 'Nombres', name: 'nombres', type: 'text' },
                { label: 'DNI', name: 'dni', type: 'number' },
                { label: 'Nacionalidad', name: 'nacionalidad', type: 'text' },
                { label: 'Fecha de Nacimiento', name: 'fechaNacimiento', type: 'date' },
                { label: 'Estado Civil', name: 'estadoCivil', type: 'text' },
              ].map((field) => (
                <div key={field.name}>
                  <label className="block text-[10px] font-black text-gray-950 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                  <input type={field.type} name={field.name} value={(formData as any)[field.name]} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:border-purple-900 outline-none transition" required />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-black text-gray-950 uppercase tracking-widest mb-2 ml-1">Sexo</label>
                <select name="sexo" value={formData.sexo} onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:border-purple-900 outline-none transition" required>
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                </select>
              </div>
            </div>

            <div className="bg-purple-950 p-8 rounded-[2rem] text-white space-y-6 shadow-xl">
               <h4 className="text-xs font-black uppercase tracking-[0.2em] border-b border-purple-800 pb-4">Ubicación del Domicilio</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">Distrito</label>
                   <input type="text" value="San Isidro" readOnly className="w-full p-4 bg-purple-900/50 border border-purple-700 rounded-xl text-white font-black cursor-not-allowed outline-none" />
                 </div>
                 <div>
                   <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">Localidad</label>
                   <input type="text" name="localidad" value={formData.localidad} onChange={handleChange} className="w-full p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none" required />
                 </div>
                 <div className="sm:col-span-2">
                   <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">Calle</label>
                   <input type="text" name="calle" value={formData.calle} onChange={handleChange} className="w-full p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none" required />
                 </div>
                 <div className="flex gap-4 sm:col-span-2">
                   <div className="flex-1">
                     <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">N°</label>
                     <input type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full p-4 bg-white text-purple-950 border-0 rounded-xl font-black outline-none" required />
                   </div>
                   <div className="w-20">
                     <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">Piso</label>
                     <input type="text" name="piso" value={formData.piso} onChange={handleChange} className="w-full p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none" />
                   </div>
                   <div className="w-20">
                     <label className="block text-[9px] font-black text-purple-300 uppercase mb-2">Dpto</label>
                     <input type="text" name="dpto" value={formData.dpto} onChange={handleChange} className="w-full p-4 bg-white text-purple-950 border-0 rounded-xl font-bold outline-none" />
                   </div>
                 </div>
               </div>
            </div>

            {!editandoId && (
              <div className="space-y-6 pt-4">
                <h4 className="text-[10px] font-black text-gray-950 uppercase tracking-widest">Carga de DNI</h4>
                <div className="flex bg-gray-50 p-2 rounded-2xl border-2 border-gray-100">
                  <button type="button" onClick={() => setModoArchivo('separado')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition uppercase tracking-widest ${modoArchivo === 'separado' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-400'}`}>Frente/Dorso</button>
                  <button type="button" onClick={() => setModoArchivo('unico')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition uppercase tracking-widest ${modoArchivo === 'unico' ? 'bg-white shadow-sm text-purple-900' : 'text-gray-400'}`}>Único</button>
                </div>
                
                {modoArchivo === 'separado' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-2 border-gray-100 rounded-3xl p-6 bg-gray-50/50 text-center">
                      <label className="cursor-pointer block">
                        <span className="block text-[10px] font-black text-gray-900 mb-4 uppercase">{fotoFrente ? 'LISTO' : 'SUBIR FRENTE'}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoFrente(e.target.files ? e.target.files[0] : null)} className="hidden" />
                        <div className={`w-full h-12 rounded-xl flex items-center justify-center border-2 border-gray-200 ${fotoFrente ? 'bg-green-500 border-green-500' : 'bg-white'}`}>
                          {fotoFrente && <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </label>
                    </div>
                    <div className="border-2 border-gray-100 rounded-3xl p-6 bg-gray-50/50 text-center">
                      <label className="cursor-pointer block">
                        <span className="block text-[10px] font-black text-gray-900 mb-4 uppercase">{fotoDorso ? 'LISTO' : 'SUBIR DORSO'}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoDorso(e.target.files ? e.target.files[0] : null)} className="hidden" />
                        <div className={`w-full h-12 rounded-xl flex items-center justify-center border-2 border-gray-200 ${fotoDorso ? 'bg-green-500 border-green-500' : 'bg-white'}`}>
                          {fotoDorso && <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-gray-100 rounded-3xl p-8 bg-gray-50/50 text-center">
                     <label className="cursor-pointer block">
                       <span className="block text-[10px] font-black text-gray-900 mb-4 uppercase">{archivoUnico ? 'PDF LISTO' : 'SELECCIONAR ARCHIVO'}</span>
                       <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivoUnico(e.target.files ? e.target.files[0] : null)} className="hidden" />
                       <div className={`w-full h-14 rounded-xl flex items-center justify-center border-2 border-gray-200 ${archivoUnico ? 'bg-green-500 border-green-500' : 'bg-white font-bold text-gray-300'}`}>
                         {archivoUnico ? <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> : 'Click para subir'}
                       </div>
                     </label>
                  </div>
                )}
              </div>
            )}

            <button disabled={subiendo} className={`w-full py-6 rounded-[2rem] font-black text-xl text-white tracking-tight active:scale-[0.98] transition mt-10 shadow-2xl ${subiendo ? 'bg-gray-400' : 'bg-purple-950 hover:bg-black'}`}>
              {subiendo ? 'PROCESANDO...' : (editandoId ? 'ACTUALIZAR FICHA' : 'REGISTRAR AFILIACIÓN')}
            </button>
          </form>
        )}

        {tab === 'registros' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-gray-950 tracking-tight">Afiliados Registrados</h3>
            <div className="grid grid-cols-1 gap-4">
              {registros.map((reg) => (
                <div key={reg.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex justify-between items-center hover:shadow-xl transition group">
                  <div>
                    <div className="text-xl font-black text-gray-950">{reg.dni}</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{reg.apellidos}, {reg.nombres}</div>
                    <button onClick={() => prepararEdicion(reg)} className="mt-4 text-purple-900 font-black text-[9px] uppercase tracking-widest border-b-2 border-purple-900 pb-0.5">Editar Datos</button>
                  </div>
                  <div className="text-right">
                    {reg.archivoDni && (
                      <a href={reg.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-block bg-black text-white font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-[0.15em]">
                        VER DNI
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {registros.length === 0 && <p className="p-20 text-center font-black text-gray-300 uppercase tracking-widest">Sin registros</p>}
          </div>
        )}
      </main>

      {/* Navegación Flotante Glassmorphism */}
      <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-6">
        <nav className="bg-white/70 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex gap-4 p-2 rounded-[2.5rem] w-full max-w-sm">
          <button onClick={() => { setTab('nueva'); setEditandoId(null); }} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${tab === 'nueva' ? 'bg-purple-950 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
            <IconNueva />
            <span className="text-[8px] font-black uppercase tracking-widest mt-1">Nueva</span>
          </button>
          
          <button onClick={() => setTab('registros')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${tab === 'registros' ? 'bg-purple-950 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
            <IconFichas />
            <span className="text-[8px] font-black uppercase tracking-widest mt-1">Fichas</span>
          </button>

          {isAdmin && (
            <button onClick={() => setTab('usuarios')} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-[2rem] transition-all duration-300 ${tab === 'usuarios' ? 'bg-purple-950 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>
              <IconUsuarios />
              <span className="text-[8px] font-black uppercase tracking-widest mt-1">Usuarios</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}