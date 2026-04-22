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

  if (loading) return <div className="p-10 text-center">Cargando sistema...</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 text-center">Gestión de Afiliaciones<br/>SIA</h1>
        <button onClick={loginConGoogle} className="bg-white text-gray-700 px-6 py-3 rounded-lg shadow-md border flex items-center gap-2 hover:bg-gray-50 transition">
          Ingresar con Gmail
        </button>
      </div>
    );
  }

  if (role === 'pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso en Revisión</h2>
          <p className="text-gray-500 mb-6">Tu cuenta ({(user as any).email}) ha sido registrada. Debes esperar a que el administrador valide tu acceso para poder cargar fichas.</p>
          <button onClick={logout} className="text-purple-700 font-semibold underline">Cerrar Sesión</button>
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
    <main className="max-w-4xl mx-auto p-4">
      <header className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="font-bold text-xl text-purple-900">SIA Gestión</h2>
          <p className="text-xs text-gray-500">{isAdmin ? 'ADMINISTRADOR' : 'AFILIADOR'}</p>
        </div>
        <button onClick={logout} className="text-red-500 text-sm font-semibold">Salir</button>
      </header>

      <nav className="flex gap-1 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setTab('nueva'); setEditandoId(null); }} className={`px-4 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition ${tab === 'nueva' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>
          {editandoId ? 'Editando' : '+ Nueva'}
        </button>
        <button onClick={() => setTab('registros')} className={`px-4 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition ${tab === 'registros' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>
          Fichas ({registros.length})
        </button>
        {isAdmin && (
          <button onClick={() => setTab('usuarios')} className={`px-4 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition ${tab === 'usuarios' ? 'bg-purple-700 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>
            Usuarios
          </button>
        )}
      </nav>

      {tab === 'usuarios' && isAdmin && (
        <div className="bg-white rounded-xl shadow-md border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Usuario</th>
                <th className="p-3">Estado/Rol</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuariosSistema.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-bold">{u.nombre}</div>
                    <div className="text-[10px] text-gray-400">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : u.rol === 'afiliador' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {u.rol !== 'afiliador' && <button onClick={() => actualizarRol(u.id, 'afiliador')} className="text-green-600 text-[10px] font-bold border border-green-600 px-2 py-1 rounded">Autorizar</button>}
                    {u.rol !== 'admin' && u.email !== (user as any).email && <button onClick={() => actualizarRol(u.id, 'admin')} className="text-purple-600 text-[10px] font-bold border border-purple-600 px-2 py-1 rounded">Hacer Admin</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'nueva' && (
        <form onSubmit={guardarFicha} className="space-y-4 bg-white p-6 rounded-xl shadow-md border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" name="apellidos" placeholder="Apellidos" value={formData.apellidos} onChange={handleChange} className="p-2 border rounded" required />
            <input type="text" name="nombres" placeholder="Nombres" value={formData.nombres} onChange={handleChange} className="p-2 border rounded" required />
            <input type="number" name="dni" placeholder="DNI" value={formData.dni} onChange={handleChange} className="p-2 border rounded" required />
            <select name="sexo" value={formData.sexo} onChange={handleChange} className="p-2 border rounded" required>
              <option value="">Sexo...</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
            <input type="text" name="nacionalidad" placeholder="Nacionalidad" value={formData.nacionalidad} onChange={handleChange} className="p-2 border rounded" required />
            <input type="date" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} className="p-2 border rounded" required />
            <input type="text" name="estadoCivil" placeholder="Estado Civil" value={formData.estadoCivil} onChange={handleChange} className="p-2 border rounded" required />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
             <p className="text-sm font-bold text-gray-500 border-b pb-1">Domicilio</p>
             <div className="grid grid-cols-2 gap-2">
               <input type="text" value="San Isidro" readOnly className="p-2 border rounded bg-gray-200 text-gray-500" />
               <input type="text" name="localidad" placeholder="Localidad" value={formData.localidad} onChange={handleChange} className="p-2 border rounded" required />
               <input type="text" name="calle" placeholder="Calle" value={formData.calle} onChange={handleChange} className="p-2 border rounded" required />
               <div className="flex gap-1">
                 <input type="text" name="numero" placeholder="N°" value={formData.numero} onChange={handleChange} className="w-full p-2 border rounded" required />
                 <input type="text" name="piso" placeholder="Piso" value={formData.piso} onChange={handleChange} className="w-1/3 p-2 border rounded" />
                 <input type="text" name="dpto" placeholder="Dpto" value={formData.dpto} onChange={handleChange} className="w-1/3 p-2 border rounded" />
               </div>
             </div>
          </div>

          <textarea name="observaciones" placeholder="Observaciones" value={formData.observaciones} onChange={handleChange} className="w-full p-2 border rounded" rows={2}></textarea>

          {!editandoId && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setModoArchivo('separado')} className={`text-xs p-2 rounded flex-1 border font-semibold ${modoArchivo === 'separado' ? 'bg-purple-100 border-purple-500 text-purple-800' : 'text-gray-500'}`}>Frente y Dorso</button>
                <button type="button" onClick={() => setModoArchivo('unico')} className={`text-xs p-2 rounded flex-1 border font-semibold ${modoArchivo === 'unico' ? 'bg-purple-100 border-purple-500 text-purple-800' : 'text-gray-500'}`}>Archivo Único</button>
              </div>
              {modoArchivo === 'separado' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Foto Frente</label>
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoFrente(e.target.files ? e.target.files[0] : null)} className="text-[10px] w-full" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Foto Dorso</label>
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => setFotoDorso(e.target.files ? e.target.files[0] : null)} className="text-[10px] w-full" />
                  </div>
                </div>
              ) : (
                <div>
                   <label className="text-[10px] text-gray-500 block mb-1">Subir PDF o Imagen unificada</label>
                   <input type="file" accept="image/*,application/pdf" onChange={(e) => setArchivoUnico(e.target.files ? e.target.files[0] : null)} className="text-xs w-full" />
                </div>
              )}
            </div>
          )}

          <button disabled={subiendo} className={`w-full py-4 rounded-lg font-bold text-white mt-4 ${subiendo ? 'bg-gray-400' : 'bg-purple-700 hover:bg-purple-800'}`}>
            {subiendo ? 'Guardando...' : (editandoId ? 'ACTUALIZAR DATOS' : 'REGISTRAR AFILIACIÓN')}
          </button>
        </form>
      )}

      {tab === 'registros' && (
        <div className="bg-white rounded-xl shadow-md border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">DNI / Nombre</th>
                {isAdmin && <th className="p-3">Afiliador</th>}
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((reg) => (
                <tr key={reg.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-bold">{reg.dni}</div>
                    <div className="text-xs text-gray-500 uppercase">{reg.apellidos}, {reg.nombres}</div>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-xs">
                      {reg.afiliadorNombre}
                    </td>
                  )}
                  <td className="p-3 flex gap-2">
                    <button onClick={() => prepararEdicion(reg)} className="text-blue-600 font-bold">Editar</button>
                    {reg.archivoDni && (
                      <a href={reg.archivoDni} target="_blank" rel="noopener noreferrer" className="text-green-600 font-bold">DNI</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registros.length === 0 && <p className="p-10 text-center text-gray-400">No hay registros cargados aún.</p>}
        </div>
      )}
    </main>
  );
}