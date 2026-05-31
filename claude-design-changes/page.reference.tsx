// ============================================================================
//  page.reference.tsx — ESQUELETO de referencia (no es drop-in)
//  Muestra cómo queda app/page.tsx tras el rediseño: tu estado + handlers
//  intactos, el render delegado a AppShell + las vistas.
//  Adaptá los nombres a los tuyos. Las partes "…tu lógica…" ya existen hoy.
// ============================================================================
'use client';
import React, { useState } from 'react';
// import { useAuth } from '../hooks/useAuth';
// import { db, storage } from '../firebaseConfig';
// import { doc, updateDoc /* …addDoc, onSnapshot, etc… */ } from 'firebase/firestore';

import { AppShell } from './components/shell/AppShell';
import { RecordsView } from './components/records/RecordsView';
import { FichaForm } from './components/ficha/FichaForm';
import { FichaDetalle } from './components/ficha/FichaDetalle';
import { ControlView } from './components/control/ControlView';
import { UsuariosView } from './components/users/UsuariosView';
import { Login, PerfilPendiente } from './components/auth/AuthScreens';
// import { EscanerDocumento } from './components/ficha/EscanerDocumento'; // o donde lo dejes

export default function Home() {
  // ───────────────────────────────────────────────────────────────────────
  //  TODO tu estado y handlers actuales se mantienen EXACTAMENTE igual.
  //  Abajo sólo se listan los que el render usa, como recordatorio.
  // ───────────────────────────────────────────────────────────────────────
  // const { user, loading, role, userData, isAdmin, isSupervisor, isAdminOrSupervisor,
  //         loginConGoogle, logout } = useAuth();
  // const [tab, setTab] = useState(...); const cambiarTab = (t) => {...};
  // const [registros, setRegistros] = useState([]);  // onSnapshot
  // const [usuariosSistema, setUsuariosSistema] = useState([]);
  // const [formData, setFormData] = useState({...}); const handleChange = (e) => {...};
  // const [editandoId, setEditandoId] = useState(null);
  // const [fichaSeleccionada, setFichaSeleccionada] = useState(null);
  // const [modoArchivo, setModoArchivo] = useState('escaner');
  // const [camaraActiva, setCamaraActiva] = useState(null);
  // const [fotoFrenteB64, setFotoFrenteB64] = useState(null);
  // const [fotoDorsoB64, setFotoDorsoB64] = useState(null);
  // const [archivoUnico, setArchivoUnico] = useState(null);
  // const [subiendo, setSubiendo] = useState(false);
  // const [busqueda, setBusqueda] = useState(''); const [busquedaControl, setBusquedaControl] = useState('');
  // const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  // const guardarFicha = async (e) => {...}; const prepararEdicion = (reg) => {...};
  // const prepararNueva = () => {...}; const actualizarRol = async (uid, rol) => {...};
  // const actualizarControl = async (id, estado, extras) => {...};
  // const exportarCSV = () => {...}; const descargarZip = async (tipo) => {...};

  // ── declaraciones mínimas para que este archivo compile como referencia ──
  const anyState = useState<any>(null);
  const _ = anyState; // evita warnings; borrá al integrar

  // Lista de afiliadores para los <select> de filtro
  // const afiliadores = usuariosSistema.filter(u => u.rol !== 'pendiente')
  //   .map(u => ({ uid: u.id, nombre: `${u.apellido}, ${u.nombre}` }));

  /*
  // ── PANTALLAS SIN SHELL ─────────────────────────────────────────────────
  if (mostrarIntro) return <IntroVideo />;
  if (loading) return <div className="p-10 text-center font-semibold text-slate-900">Iniciando SIA…</div>;
  if (!user) return <Login onLogin={loginConGoogle} />;
  if (role === 'pendiente') {
    return (
      <PerfilPendiente
        etapa={userData?.perfilCompleto ? 'espera' : 'form'}
        nombre={userData?.nombre} apellido={userData?.apellido}
        guardando={guardandoPerfil}
        onSubmit={async ({ nombre, apellido }) => {
          // tu updateDoc(doc(db,'usuarios',user.uid), { nombre, apellido, perfilCompleto:true })
          // + fetch('/api/notificar-nuevo-usuario', ...)
        }}
        onLogout={logout}
      />
    );
  }

  // ── APP CON SHELL ───────────────────────────────────────────────────────
  return (
    <AppShell
      role={role} userData={userData} tab={tab}
      search={busqueda} setSearch={setBusqueda}
      onNav={cambiarTab} onNueva={prepararNueva} onLogout={logout}
    >
      {camaraActiva && (
        <EscanerDocumento
          titulo={camaraActiva === 'frente' ? 'Escanear Frente DNI' : camaraActiva === 'dorso' ? 'Escanear Dorso DNI' : 'Escanear Ficha'}
          tipo={camaraActiva.includes('ficha') ? 'ficha' : 'dni'}
          onClose={() => setCamaraActiva(null)}
          onCapture={(dataUrl) => { /* …igual que hoy… */ }}
        />
      )}

      {tab === 'registros' && (
        <RecordsView
          role={role}
          registros={isAdminOrSupervisor ? registros : registros.filter(r => r.afiliadorUid === user.uid)}
          afiliadores={afiliadores} search={busqueda}
          onOpenDetalle={(id) => { setFichaSeleccionada(registros.find(r => r.id === id)); cambiarTab('detalle'); }}
          onExportCSV={exportarCSV} onDescargarZip={() => descargarZip('dni')}
        />
      )}

      {tab === 'detalle' && fichaSeleccionada && (
        <FichaDetalle ficha={fichaSeleccionada} role={role}
          onBack={() => cambiarTab('registros')} onEdit={prepararEdicion} />
      )}

      {(tab === 'nueva' || tab === 'editar') && (
        <FichaForm
          formData={formData} onChange={handleChange} onSubmit={guardarFicha}
          onCancel={() => cambiarTab('registros')} editando={!!editandoId} subiendo={subiendo}
          dni={{
            modo: modoArchivo, setModo: setModoArchivo,
            frenteOk: !!fotoFrenteB64, dorsoOk: !!fotoDorsoB64,
            onScanFrente: () => setCamaraActiva('frente'),
            onScanDorso: () => setCamaraActiva('dorso'),
            onPickFile: (file) => setArchivoUnico(file),
          }}
        />
      )}

      {tab === 'usuarios' && isAdminOrSupervisor && (
        <UsuariosView role={role} usuarios={usuariosSistema}
          actualizarRol={actualizarRol}
          guardarNombre={(uid, d) => updateDoc(doc(db, 'usuarios', uid), d)} />
      )}

      {tab === 'control' && isAdmin && (
        <ControlView fichas={registros} afiliadores={afiliadores} search={busquedaControl}
          actualizarControl={actualizarControl}
          onSubirFichaFisica={(id) => { setFichaControlDetalleId(id); setCamaraActiva('fichaControl'); }} />
      )}
    </AppShell>
  );
  */

  return null; // ← borrá esto al integrar; arriba está el render real comentado
}
