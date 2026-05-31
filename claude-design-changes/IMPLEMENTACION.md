# Implementación en tu proyecto — qué reemplazar y qué agregar

Esta carpeta (`nextjs/`) espeja la estructura de tu `app/`. Copiá cada archivo a la ruta indicada.
**Todo es UI.** No toca Firebase, Auth, rutas ni reglas. Las vistas reciben datos y callbacks por props; vos los conectás a tus handlers actuales de `page.tsx`.

---

## ✅ Archivos a AGREGAR (nuevos)

| Copiar de `nextjs/…` | A tu proyecto |
|---|---|
| `app/lib/types.ts` | `app/lib/types.ts` |
| `app/lib/estados.ts` | `app/lib/estados.ts` |
| `app/components/ui/Icon.tsx` | igual |
| `app/components/ui/Button.tsx` | igual |
| `app/components/ui/Badges.tsx` | igual |
| `app/components/ui/Primitives.tsx` | igual |
| `app/components/ui/Form.tsx` | igual |
| `app/components/ui/Stepper.tsx` | igual |
| `app/components/shell/nav.ts` | igual |
| `app/components/shell/Sidebar.tsx` | igual |
| `app/components/shell/TopBar.tsx` | igual |
| `app/components/shell/MobileNav.tsx` | igual |
| `app/components/shell/AppShell.tsx` | igual |
| `app/components/records/RecordsView.tsx` | igual |
| `app/components/ficha/FichaForm.tsx` | igual |
| `app/components/ficha/FichaDetalle.tsx` | igual |
| `app/components/control/ControlView.tsx` | igual |
| `app/components/users/UsuariosView.tsx` | igual |
| `app/components/auth/AuthScreens.tsx` | igual |

## ✏️ Archivos a MODIFICAR (ya existen)

| Archivo | Cambio |
|---|---|
| `app/globals.css` | **Añadir** (no reemplazar) el contenido de `app/globals.additions.css` después de `@import "tailwindcss";`. Aporta tokens `brand-*`, sombras y `.tnum`. |
| `app/page.tsx` | Reemplazar el **JSX** por `<AppShell>` + las vistas (ver `page.reference.tsx`). **Mantené intactos** todos tus `useState`, `useEffect`, `onSnapshot`, `addDoc`, `updateDoc`, `guardarFicha`, `actualizarControl`, `descargarZip`, `exportarCSV` y el componente `EscanerDocumento`. |
| `app/layout.tsx` | Sin cambios obligatorios (Inter y `themeColor` ya están bien). |

## 🚫 NO tocar
`firebaseConfig.js` · `hooks/useAuth.js` · `app/api/*` · `firestore.rules` · `storage.rules` · `public/manifest.json` · lógica de `EscanerDocumento` (sólo sus clases, si querés).

---

## Cómo conecta cada vista con tu lógica

Las vistas son **presentacionales**: no llaman a Firebase, reciben props.

| Componente | Props de datos | Callbacks (enganchá a tus handlers) |
|---|---|---|
| `RecordsView` | `registros`, `afiliadores`, `search` | `onOpenDetalle(id)`, `onExportCSV`, `onDescargarZip` |
| `FichaForm` | `formData`, `editando`, `subiendo` | `onChange` = tu `handleChange`, `onSubmit` = tu `guardarFicha`, `dni.*` → tu `EscanerDocumento` |
| `FichaDetalle` | `ficha`, `role` | `onBack`, `onEdit(ficha)` → tu `prepararEdicion` |
| `ControlView` | `fichas`, `afiliadores`, `search` | `actualizarControl(id, estado, extras)`, `onSubirFichaFisica(id)` → abre cámara/archivo |
| `UsuariosView` | `usuarios`, `role` | `actualizarRol(uid, rol)`, `guardarNombre(uid, {nombre, apellido})` |
| `AppShell` | `role`, `userData`, `tab`, `search` | `onNav(tab)` = tu `cambiarTab`, `onNueva`, `onLogout`, `setSearch` |

> El **filtrado por permiso** (afiliador ve sólo lo suyo) seguí haciéndolo donde ya lo hacés: pasá a `RecordsView` los `registros` ya acotados. Las vistas sólo agregan el filtro de búsqueda/estado de UI.

---

## `page.tsx` de referencia (esqueleto)

`page.reference.tsx` muestra el cascarón: mantiene tu estado/handlers y delega el render. Adaptalo a tus nombres reales. Lo esencial:

```tsx
'use client';
// … tus imports de Firebase, useAuth, etc.
import { AppShell } from './components/shell/AppShell';
import { RecordsView } from './components/records/RecordsView';
import { FichaForm } from './components/ficha/FichaForm';
import { FichaDetalle } from './components/ficha/FichaDetalle';
import { ControlView } from './components/control/ControlView';
import { UsuariosView } from './components/users/UsuariosView';
import { Login, PerfilPendiente } from './components/auth/AuthScreens';

export default function Home() {
  // … TODO tu estado y handlers actuales se mantienen igual …

  // afiliadores para los <select> de filtro
  const afiliadores = usuariosSistema
    .filter(u => u.rol !== 'pendiente')
    .map(u => ({ uid: u.id, nombre: `${u.apellido}, ${u.nombre}` }));

  // --- pantallas sin shell ---
  if (mostrarIntro) return /* tu intro de video */;
  if (loading) return <div className="p-10 text-center font-semibold text-slate-900">Iniciando SIA…</div>;
  if (!user) return <Login onLogin={loginConGoogle} />;
  if (role === 'pendiente') {
    return (
      <PerfilPendiente
        etapa={userData?.perfilCompleto ? 'espera' : 'form'}
        nombre={userData?.nombre} apellido={userData?.apellido}
        guardando={guardandoPerfil}
        onSubmit={async ({ nombre, apellido }) => { /* tu updateDoc de perfil + notificar */ }}
        onLogout={logout}
      />
    );
  }

  // --- app con shell ---
  return (
    <AppShell
      role={role} userData={userData} tab={tab}
      search={busqueda} setSearch={setBusqueda}
      onNav={cambiarTab} onNueva={prepararNueva} onLogout={logout}
    >
      {camaraActiva && <EscanerDocumento /* …igual que hoy… */ />}

      {tab === 'registros' && !fichaSeleccionada && (
        <RecordsView
          role={role} registros={registrosVisibles} afiliadores={afiliadores}
          search={busqueda} onOpenDetalle={(id) => { setFichaSeleccionada(registros.find(r => r.id === id)); cambiarTab('detalle'); }}
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
}
```

> `registrosVisibles` = tus `registros` ya filtrados por permiso (lo que hoy hacés con `registrosFiltrados`, sin el filtro de búsqueda que ahora vive en la vista). Si preferís, pasá `registros` directamente y dejá que la vista filtre por búsqueda/estado.

---

## Orden de implementación (cada paso compila y deploya solo)

1. `globals.css` ← tokens. (Verificá que `bg-brand-700` rinde.)
2. `lib/types.ts` + `lib/estados.ts`.
3. `components/ui/*` (no se ven hasta usarlos).
4. `components/shell/*` → envolvé el return de `page.tsx` con `<AppShell>` y borrá tu `<header>` viejo.
5. `RecordsView` → reemplazá el bloque de registros.
6. `FichaForm` + `FichaDetalle`.
7. `ControlView` + `UsuariosView` + `AuthScreens`.
8. Pulido responsive.

---

## Notas Next 16 / Tailwind 4

- Todo es client-side (`'use client'` en `page.tsx`). Los componentes nuevos no necesitan `'use client'` propio porque se importan desde un árbol cliente; si TS/Next se queja con alguno que usa `useState` (p. ej. `FichaForm`, `ControlView`, `UsuariosView`, `RecordsView`), agregale `'use client'` en la primera línea.
- Usé `next/image` en `Sidebar`, `AuthScreens` para el logo (`/logo.png`). Si preferís `<img>`, cambialo: no afecta nada.
- Tokens vía `@theme` (Tailwind 4), no `tailwind.config.js`.
- Si tocás `app/api/*` por cualquier motivo, leé primero `node_modules/next/dist/docs/` como pide `AGENTS.md`.
