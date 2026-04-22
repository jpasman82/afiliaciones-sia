'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, storage } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import jsPDF from 'jspdf';

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

  // Escuchar registros de afiliación
  useEffect(() => {
    if (!user || role === 'pendiente') return;
    const q = isAdmin 
      ? query(collection(db, 'afiliaciones'), orderBy('fecha', 'desc'))
      : query(collection(db, 'afiliaciones'), where('afiliadorUid', '==', (user as any).uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRegistros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, isAdmin, role]);

  // Escuchar lista de usuarios (solo para Admin)
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'usuarios'), orderBy('fechaRegistro', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsuariosSistema(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [isAdmin]);

  if (loading) return <div className="p-10 text-center font-bold text-gray-800">Cargando sistema...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-extrabold mb-8 text-purple-900 text-center tracking-tight">Afiliaciones<br/>SIA</h1>
        <button onClick={loginConGoogle} className="bg-white text-gray-900 font-bold px-8 py-4 rounded-xl shadow-lg border-2 border-gray-200 flex items-center gap-2 hover:bg-gray-50 transition active:scale-95">
          Ingresar con Gmail
        </button>
      </div>
    );
  }

  if (role === 'pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200">
          <h2 className="text-2xl font-black text-gray-900 mb-4">Acceso en Revisión</h2>
          <p className="text-gray-700 mb-8 font-medium">Tu cuenta ({(user as any).email}) ha sido registrada. Debes esperar a que el administrador valide tu acceso para poder cargar fichas.</p>
          <button onClick={logout} className="text-white bg-purple-700 hover:bg-purple-800 font-bold py-3 px-6 rounded-xl transition w-full">Cerrar Sesión</button>
        </div>
      </div>
    );
  }

  const actualizarRol = async (uid: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), { rol: nuevoRol });
      alert('Rol actualizado con éxito');
    } catch (e) {
      alert('Error al actualizar permisos');
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
        const docRef = doc(db, 'afiliaciones', editandoId);
        const updateData: any = { ...formData, últimaModificación: serverTimestamp() };
        if (urlDni) updateData.archivoDni = urlDni;
        await updateDoc(docRef, updateData);
        alert('Registro actualizado');
      } else {
        await addDoc(collection(db, 'afiliaciones'), {
          ...formData,
          archivoDni: urlDni,
          afiliadorNombre: (user as any).displayName || '',
          afiliadorEmail: (user as any).email,
          afiliadorUid: (user as any).uid,
          fecha: serverTimestamp(),
        });
        alert('Afiliación cargada con éxito');
      }

      setEditandoId(null);
      setTab('registros');
      setFormData({ apellidos: '', nombres: '', dni: '', sexo: '', nacionalidad: '', fechaNacimiento: '', estadoCivil: '', distrito: 'San Isidro', calle: '', numero: '', piso: '', dpto: '', localidad: '', observaciones: '' });
      setFotoFrente(null);
      setFotoDorso(null);
      setArchivoUnico(null);
    } catch (error) {
      console.error(error);
      alert('Error al procesar');
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Fijo Arriba */}
      <header className="bg-white shadow-sm px-4 py-4 sticky top-0 z-40 flex justify-between items-center border-b border-gray-200">
        <div>
          <h2 className="font-black text-xl text-purple-900 tracking-tight">SIA Gestión</h2>
          <p className="text-xs font-bold text-gray-500">{isAdmin ? 'MODO ADMINISTRADOR' : 'AFILIADOR'}</p>
        </div>
        <button onClick={logout} className="text-red-600 bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold border border-red-200 active:scale-95 transition">
          Salir
        </button>
      </header>

      {/* Contenedor Principal (con padding bottom para que no lo tape la barra flotante) */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 pb-28">
        
        {/* Pestaña: Usuarios */}
        {tab === 'usuarios' && isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden">
            <div className="p-4 bg-gray-100 border-b border-gray-300">
              <h3 className="font-black text-gray-900">Gestión de Usuarios</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="p-4 font-bold text-gray-900">Usuario</th>
                    <th className="p-4 font-bold text-gray-900">Rol</th>
                    <th className="p-4 font-bold text-gray-900 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosSistema.map((u) => (
                    <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{u.nombre}</div>
                        <div className="text-xs text-gray-600 mt-1">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${u.rol === 'admin' ? 'bg-purple-100 text-purple-800' : u.rol === 'afiliador' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {u.rol !== 'afiliador' && <button onClick={() => actualizarRol(u.id, 'afiliador')} className="text-green-700 bg-green-50 text-xs font-bold border border-green-300 px-3 py-2 rounded-lg active:scale-95">Autorizar</button>}
                        {u.rol !== 'admin' && u.email !== (user as any).email && <button onClick={() => actualizarRol(u.id, 'admin')} className="text-purple-700 bg-purple-50 text-xs font-bold border border-purple-300 px-3 py-2 rounded-lg active:scale-95">Admin</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pestaña: Nueva Ficha */}
        {tab === 'nueva' && (
          <form onSubmit={guardarFicha} className="space-y-6 bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-300">
            <h3 className="text-xl font-black text-gray-900 border-b border-gray-200 pb-3">
              {editandoId ? '📝 Editando Ficha' : '📝 Nueva Afiliación'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Apellidos</label>
                <input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Nombres</label>
                <input type="text" name="nombres" value={formData.nombres} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">DNI (Matrícula)</label>
                <input type="number" name="dni" value={formData.dni} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Sexo</label>
                <select name="sexo" value={formData.sexo} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition bg-white" required>
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Nacionalidad</label>
                <input type="text" name="nacionalidad" value={formData.nacionalidad} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Fecha de Nacimiento</label>
                <input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Estado Civil</label>
                <input type="text" name="estadoCivil" value={formData.estadoCivil} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" required />
              </div>
            </div>

            <div className="bg-gray-100 p-5 rounded-2xl border border-gray-300 space-y-4">
               <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-2">📍 Domicilio</h4>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-700 mb-1">Distrito</label>
                   <input type="text" value="San Isidro" readOnly className="w-full p-3 border-2 border-gray-300 rounded-xl bg-gray-200 text-gray-600 font-bold cursor-not-allowed outline-none" />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-700 mb-1">Localidad</label>
                   <input type="text" name="localidad" value={formData.localidad} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none bg-white transition" required />
                 </div>
                 <div className="sm:col-span-2">
                   <label className="block text-xs font-bold text-gray-700 mb-1">Calle</label>
                   <input type="text" name="calle" value={formData.calle} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none bg-white transition" required />
                 </div>
                 <div className="flex gap-3 sm:col-span-2">
                   <div className="flex-1">
                     <label className="block text-xs font-bold text-gray-700 mb-1">Número</label>
                     <input type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-bold focus:border-purple-600 focus:ring-0 outline-none bg-white transition" required />
                   </div>
                   <div className="w-24">
                     <label className="block text-xs font-bold text-gray-700 mb-1">Piso</label>
                     <input type="text" name="piso" value={formData.piso} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none bg-white transition" />
                   </div>
                   <div className="w-24">
                     <label className="block text-xs font-bold text-gray-700 mb-1">Dpto</label>
                     <input type="text" name="dpto" value={formData.dpto} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none bg-white transition" />
                   </div>
                 </div>
               </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-900 uppercase tracking-wide mb-1">Observaciones</label>
              <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} className="w-full p-3 border-2 border-gray-300 rounded-xl text-gray-900 font-medium focus:border-purple-600 focus:ring-0 outline-none transition" rows={3}></textarea>
            </div>

            {!editandoId && (
              <div className="space-y-4 border-t-2 border-gray-200 pt-6 mt-4">
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-wide">📸 Documentación DNI</h4>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button type="button" onClick={() => setModoArchivo('separado')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-black transition ${modoArchivo === 'separado' ? 'bg-white shadow-md text-purple-700' : 'text-gray-500'}`}>Frente y Dorso</button>
                  <button type="button" onClick={() => setModoArchivo('unico')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-black transition ${modoArchivo === 'unico' ? 'bg-white shadow-md text-purple-700' : 'text-gray-500'}`}>Archivo Único</button>
                </div>
                
                {modoArchivo === 'separado' ? (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 text-center relative hover:bg-gray-100 transition">
                      <label className="cursor-pointer block">
                        <span className="block text-sm font-bold text-gray-900 mb-2">{fotoFrente ? '✅ Cargado' : 'Subir Frente'}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoFrente(e.target.files ? e.target.files[0] : null)} className="w-full text-xs file:bg-purple-100 file:text-purple-800 file:border-0 file:rounded-lg file:px-3 file:py-1 file:font-bold" required={!fotoFrente} />
                      </label>
                    </div>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 text-center relative hover:bg-gray-100 transition">
                      <label className="cursor-pointer block">
                        <span className="block text-sm font-bold text-gray-900 mb-2">{fotoDorso ? '✅ Cargado' : 'Subir Dorso'}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoDorso(e.target.files ? e.target.files[0] : null)} className="w-full text-xs file:bg-purple-100 file:text-purple-800 file:border-0 file:rounded-lg file:px-3 file:py-1 file:font-bold" required={!fotoDorso} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 bg-gray-50 text-center mt-4 hover:bg-gray-100 transition">
                     <label className="cursor-pointer block">
                       <span className="block text-sm font-bold text-gray-900 mb-2">{archivoUnico ? '✅ Archivo Listo' : 'Seleccionar PDF o Imagen'}</span>
                       <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivoUnico(e.target.files ? e.target.files[0] : null)} className="w-full text-sm file:bg-purple-100 file:text-purple-800 file:border-0 file:rounded-lg file:px-4 file:py-2 file:font-bold" required={!archivoUnico} />
                     </label>
                  </div>
                )}
              </div>
            )}

            <button disabled={subiendo} className={`w-full py-5 rounded-2xl font-black text-lg text-white shadow-lg active:scale-95 transition mt-8 ${subiendo ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-800'}`}>
              {subiendo ? 'PROCESANDO DATOS...' : (editandoId ? 'ACTUALIZAR FICHA' : 'REGISTRAR AFILIACIÓN')}
            </button>
          </form>
        )}

        {/* Pestaña: Registros */}
        {tab === 'registros' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-300 overflow-hidden">
             <div className="p-4 bg-gray-100 border-b border-gray-300">
              <h3 className="font-black text-gray-900">Total de Fichas: {registros.length}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="p-4 font-bold text-gray-900">Afiliado</th>
                    {isAdmin && <th className="p-4 font-bold text-gray-900">Cargado por</th>}
                    <th className="p-4 font-bold text-gray-900 text-right">Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((reg) => (
                    <tr key={reg.id} className="border-b border-gray-200 hover:bg-purple-50 transition">
                      <td className="p-4">
                        <div className="font-black text-gray-900 text-base">{reg.dni}</div>
                        <div className="text-xs font-bold text-gray-600 uppercase mt-1">{reg.apellidos}, {reg.nombres}</div>
                        <button onClick={() => prepararEdicion(reg)} className="mt-2 text-purple-700 font-black text-xs uppercase tracking-wide hover:underline">✏️ Editar Datos</button>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-xs font-medium text-gray-700">
                          {reg.afiliadorNombre}
                        </td>
                      )}
                      <td className="p-4 text-right align-middle">
                        {reg.archivoDni ? (
                          <a href={reg.archivoDni} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-100 text-green-800 font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider border border-green-300 active:scale-95 transition">
                            Ver DNI
                          </a>
                        ) : (
                          <span className="text-xs font-bold text-gray-400">Sin archivo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {registros.length === 0 && <p className="p-10 text-center font-bold text-gray-400">No hay registros cargados aún.</p>}
          </div>
        )}
      </main>

      {/* Navegación Flotante Inferior (Estilo App Nativa) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex justify-around items-center px-2 pb-6 pt-3 z-50">
        <button onClick={() => { setTab('nueva'); setEditandoId(null); }} className={`flex-1 flex flex-col items-center justify-center p-2 transition ${tab === 'nueva' ? 'text-purple-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
          <span className="text-2xl mb-1">📝</span>
          <span className={`text-[10px] uppercase tracking-wide ${tab === 'nueva' ? 'font-black' : 'font-bold'}`}>Nueva</span>
        </button>
        
        <button onClick={() => setTab('registros')} className={`flex-1 flex flex-col items-center justify-center p-2 transition ${tab === 'registros' ? 'text-purple-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
          <span className="text-2xl mb-1">📁</span>
          <span className={`text-[10px] uppercase tracking-wide ${tab === 'registros' ? 'font-black' : 'font-bold'}`}>Fichas</span>
        </button>

        {isAdmin && (
          <button onClick={() => setTab('usuarios')} className={`flex-1 flex flex-col items-center justify-center p-2 transition ${tab === 'usuarios' ? 'text-purple-700 scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
            <span className="text-2xl mb-1">👥</span>
            <span className={`text-[10px] uppercase tracking-wide ${tab === 'usuarios' ? 'font-black' : 'font-bold'}`}>Usuarios</span>
          </button>
        )}
      </nav>
    </div>
  );
}