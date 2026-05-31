# Contexto de la aplicacion - Afiliaciones SIA

Este documento resume el contexto funcional y tecnico de la app para que Claude, Codex u otro agente pueda trabajar en el proyecto sin tener que reconstruir el mapa completo desde cero.

## Resumen

Afiliaciones SIA es una aplicacion web interna para cargar, administrar y controlar fichas de afiliacion. La app permite:

- Autenticacion con Google.
- Alta de usuarios y aprobacion de accesos por rol.
- Carga de fichas de afiliados con datos personales, domicilio y DNI.
- Captura de DNI desde camara o carga de archivo local.
- Listado, busqueda, detalle y edicion de fichas.
- Control administrativo del estado de cada afiliacion ante la JE.
- Carga de ficha fisica firmada.
- Exportacion de registros y descarga masiva de archivos en ZIP.

La aplicacion esta orientada principalmente a uso mobile en campo, pero tambien tiene vistas desktop para administracion.

## Stack

- Next.js `16.2.4` con App Router.
- React `19.2.4`.
- TypeScript en archivos de `app/`.
- Firebase:
  - Authentication con Google OAuth.
  - Firestore como base de datos.
  - Firebase Storage para DNIs y fichas.
- Tailwind CSS `4`.
- Nodemailer para emails via Gmail SMTP.
- JSZip para descargas masivas.

Importante: este proyecto usa Next.js 16. Antes de modificar codigo de Next, leer la documentacion local indicada en `AGENTS.md`: `node_modules/next/dist/docs/`.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de produccion
npm run lint     # ESLint
npm start        # servidor de produccion, luego del build
```

No hay suite de tests configurada.

## Variables de entorno

El archivo `.env.local` debe definir:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

EMAIL_USER=
EMAIL_PASS=

API_SECRET_TOKEN=
NEXT_PUBLIC_API_SECRET_TOKEN=
```

Notas:

- `EMAIL_PASS` debe ser una App Password de Gmail, no la password normal de la cuenta.
- `API_SECRET_TOKEN` protege `/api/notificar`.
- `/api/notificar-nuevo-usuario` usa el ID token de Firebase del usuario autenticado.

## Estructura relevante

- `app/page.tsx`: contiene la logica cliente principal, estado, listeners de Firestore y handlers. Es un componente `'use client'`.
- `app/components/`: componentes presentacionales del rediseño.
  - `shell/`: `AppShell`, `Sidebar`, `TopBar`, `MobileNav` y navegacion.
  - `records/`: listado de fichas.
  - `ficha/`: formulario y detalle de ficha.
  - `control/`: modulo administrativo de control.
  - `users/`: gestion de usuarios.
  - `auth/`: login y pantallas de perfil pendiente.
  - `ui/`: primitivas visuales compartidas.
- `app/lib/`: tipos y constantes de dominio (`types.ts`, `estados.ts`).
- `hooks/useAuth.js`: hook de autenticacion, rol y perfil del usuario.
- `firebaseConfig.js`: inicializacion de Firebase Auth, Firestore y Storage.
- `app/api/notificar/route.ts`: endpoint protegido por secret para enviar email.
- `app/api/notificar-nuevo-usuario/route.ts`: endpoint que valida ID token Firebase y notifica nuevo usuario.
- `firestore.rules`: reglas de seguridad de Firestore.
- `storage.rules`: reglas de seguridad de Storage.
- `app/layout.tsx`: metadata, viewport y fuente.
- `app/globals.css`: Tailwind y estilos globales minimos.
- `public/logo.png`: logo de la app.
- `public/video.mp4`: intro/splash inicial.
- `public/manifest.json`: manifest PWA.

## Arquitectura

La app es una single-page app renderizada del lado cliente. No hay SSR relevante para datos de negocio.

`app/page.tsx` mantiene el estado principal con `useState`, escucha Firestore en tiempo real con `onSnapshot` y delega el render en componentes presentacionales. La UI actual esta envuelta en `AppShell`.

Las vistas nuevas no llaman a Firebase directamente: reciben datos y callbacks desde `page.tsx`. La excepcion es que algunos componentes manejan estado local de filtros o formularios visuales.

La navegacion interna se maneja por tabs:

- `registros`: listado operativo de fichas.
- `nueva`: formulario de nueva ficha.
- `editar`: formulario para editar una ficha existente.
- `detalle`: vista detallada de una ficha.
- `usuarios`: gestion de usuarios y roles.
- `control`: modulo admin para seguimiento ante la JE.

El estado de tabs se sincroniza con `history.pushState` y `popstate` para que el boton atras del navegador funcione.

## Autenticacion y perfil

El hook `useAuth`:

- Usa `onAuthStateChanged` de Firebase Auth.
- Solo permite login con Google mediante `signInWithPopup`.
- Escucha el documento del usuario en `usuarios/{uid}`.
- Si el usuario no tiene documento, crea uno con:
  - `email`
  - `nombre: ''`
  - `apellido: ''`
  - `rol: 'pendiente'`
  - `perfilCompleto: false`
  - `fechaRegistro`

Flujo de primer ingreso:

1. El usuario entra con Google.
2. Se crea su doc en `usuarios`.
3. Si esta pendiente y no completo perfil, se muestra formulario de nombre y apellido.
4. Al completar perfil se actualiza `perfilCompleto: true`.
5. Se llama a `/api/notificar-nuevo-usuario` con ID token Firebase.
6. Admin o supervisor deben aprobarlo desde la vista `Usuarios`.

## Roles

Roles actuales:

- `pendiente`: usuario registrado, sin acceso operativo.
- `afiliador`: puede cargar fichas y ver sus propios registros.
- `supervisor`: puede ver todas las fichas, administrar usuarios limitadamente y editar registros.
- `admin`: acceso completo, incluido modulo de control.

Permisos funcionales:

- Afiliador:
  - Crea fichas propias.
  - Ve solo fichas donde `afiliadorUid` sea su UID.
  - Puede editar fichas propias mientras el flujo de control lo permita.
- Supervisor:
  - Ve todas las fichas.
  - Ve y gestiona usuarios.
  - Puede aprobar usuarios como `afiliador`.
  - No puede asignar `admin` ni `supervisor`.
- Admin:
  - Ve todas las fichas.
  - Gestiona todos los roles.
  - Accede al modulo `Control`.
  - Puede editar fichas aun en estados avanzados.

## Firestore

### Coleccion `usuarios`

Documento: `usuarios/{uid}`.

Campos usados:

- `email`: email de Google.
- `nombre`: nombre ingresado o editado.
- `apellido`: apellido ingresado o editado.
- `rol`: `pendiente`, `afiliador`, `supervisor` o `admin`.
- `perfilCompleto`: booleano.
- `fechaRegistro`: fecha de registro.

### Coleccion `afiliaciones`

Documento autogenerado por `addDoc`.

Campos principales de persona:

- `tipoDocumento`: `DNI`, `LE` o `LC`.
- `dni`.
- `apellidos`.
- `nombres`.
- `sexo`: `Masculino` o `Femenino`.
- `clase`: anio.
- `fechaNacimiento`: string en formato `DD/MM/AAAA`.
- `lugarNacimiento`.
- `nacionalidad`.
- `profesion`.
- `estadoCivil`.
- `celular`.
- `mail`.

Campos de domicilio:

- `distrito`: actualmente fijo en `Buenos Aires`.
- `localidad`: `Acassuso`, `Beccar`, `Boulogne`, `Martinez`, `San Isidro`, `Villa Adelina`.
- `calle`.
- `numero`.
- `piso`.
- `dpto`.

Campos de archivos:

- `archivoDni`: URL de Firebase Storage.
- `archivoFicha`: URL de Firebase Storage.

Campos de autoria:

- `afiliadorNombre`.
- `afiliadorEmail`.
- `afiliadorUid`.
- `fecha`: timestamp de creacion.
- `ultimaModificacion`: timestamp de edicion. En codigo se escribe como clave unicode computada para evitar problemas de encoding.

Campos de control:

- `estadoControl`: estado actual del circuito.
- `fechaUltimoControl`.
- `ultimoControlPor`.
- `ultimoControlPorUid`.
- `historialControl`: array de auditoria de acciones de control. Cada item guarda:
  - `accion`: estado aplicado o `reactivacion`.
  - `estadoAnterior`.
  - `estadoNuevo`.
  - `fecha`: ISO string.
  - `por`: operador visible.
  - `uid`: UID del operador.
  - `comentario`: error, motivo de baja/suspension o comentario de reactivacion.
- `fechaFirma`.
- `firmadoPor`.
- `firmadoPorUid`.
- `fechaEscaneado`.
- `escaneadoPor`.
- `escaneadoPorUid`.
- `fechaCargaJE`.
- `cargadoJEPor`.
- `cargadoJEPorUid`.
- `fechaAprobacion`.
- `aprobadoPor`.
- `aprobadoPorUid`.
- `fechaErrorJE`.
- `errorPor`.
- `errorPorUid`.
- `errorJE`.
- `editadoPorAdmin`.
- `fechaEdicionAdmin`.
- `estadoAnterior`.
- `fechaSuspension`.
- `suspendidoPor`.
- `suspendidoPorUid`.
- `suspendidoComentario`.
- `fechaBaja`.
- `bajaPor`.
- `bajaPorUid`.
- `fechaReactivacion`.
- `reactivadoPor`.
- `reactivadoPorUid`.
- `reactivacionComentario`.

## Estados de control

`estadoControl` puede ser:

- `pendiente`: ficha digital cargada, pendiente de ficha fisica.
- `firmado`: estado definido en UI, pero el flujo actual normalmente pasa de `pendiente` a `escaneado`.
- `escaneado`: ficha fisica subida a Storage.
- `cargado_je`: ficha cargada en la web de la JE.
- `aprobado`: afiliacion aprobada por JE.
- `error`: JE devolvio un error; se guarda descripcion en `errorJE`.
- `suspendido`: afiliado suspendido temporalmente.
- `baja`: afiliado dado de baja.

Flujo principal:

1. Nueva ficha se crea con `estadoControl: 'pendiente'`.
2. Admin sube ficha fisica desde camara o archivo.
3. Se guarda en Storage `fichas/` y pasa a `escaneado`.
4. Admin marca como cargada en JE y pasa a `cargado_je`.
5. Admin marca como `aprobado` o registra `error`.
6. Desde ciertos estados se puede suspender, dar de baja o reactivar.

Toda transicion realizada desde Control pasa por `actualizarControl` y queda registrada en `historialControl` con operador, UID, fecha/hora y comentario si aplica. Para fichas viejas sin `historialControl`, la UI muestra un historial de respaldo armado desde campos sueltos.

## Storage

Rutas usadas:

- `dnis/{dni}-{timestamp}.jpg` para DNI capturado con camara.
- `dnis/{dni}-{timestamp}` para archivo local de DNI, imagen o PDF.
- `fichas/{id}-{timestamp}.jpg` para ficha fisica escaneada o subida.

Reglas:

- Usuarios autenticados pueden leer y escribir en `dnis/` y `fichas/`.
- Delete esta bloqueado.

## Captura de documentos

Componente: `EscanerDocumento`.

Usa `navigator.mediaDevices.getUserMedia` con `facingMode: 'environment'`.

Para DNI:

- Captura frente y dorso.
- Recorta usando un marco visual.
- Combina ambas imagenes verticalmente en un unico JPEG.
- Sube el resultado a Storage.

Para ficha fisica:

- Captura una imagen con mas contraste y escala de grises.
- Sube el archivo a Storage.

Tambien se permite carga de archivo local:

- DNI: `image/*` o `application/pdf`.
- Ficha: actualmente `image/*`.

## Vistas principales

### Login

Muestra logo y boton `Ingresar con Gmail`.

Antes del login hay una intro de video (`/video.mp4`) durante hasta 6 segundos o hasta que termine/falle el video. En desktop se muestra con `object-contain` y limites de ancho/alto para no recortar el contenido.

### Perfil pendiente

Si el usuario tiene rol `pendiente` y `perfilCompleto` falso, se le pide nombre y apellido.

Si ya completo perfil, se muestra pantalla de acceso pendiente.

### Nueva ficha / Editar ficha

Formulario con datos personales, domicilio y documentacion.

Validaciones actuales:

- Muchos campos son `required` a nivel HTML.
- `fechaNacimiento` se formatea como `DD/MM/AAAA`.
- `clase` acepta hasta 4 digitos.
- `dni` y `numero` usan inputs numericos.

Al crear:

- Sube DNI si corresponde.
- Crea documento en `afiliaciones`.
- Adjunta datos de afiliador desde `userData` y Firebase Auth.

Al editar:

- Actualiza documento.
- Si admin edita un registro en estado avanzado, guarda auditoria de edicion admin.

### Registros

Listado operativo con:

- Busqueda por DNI, nombres o apellidos.
- Filtro por afiliador para admin/supervisor.
- Indicadores de presencia de DNI y ficha.
- Indicador visual segun `estadoControl`.

Admin/supervisor ven todo. Afiliador ve solo lo propio.

### Detalle

Muestra ficha completa y links a archivos.

Permite editar si:

- La ficha no esta en estados avanzados, o
- El usuario es admin.

### Usuarios

Disponible para admin y supervisor.

Permite:

- Ver usuarios.
- Editar nombre y apellido.
- Cambiar rol.

Restricciones de UI:

- El supervisor no puede editar usuarios admin/supervisor.
- El supervisor solo puede asignar/revocar acceso como `afiliador` o `pendiente`.
- Admin puede asignar `admin`, `supervisor`, `afiliador` o `pendiente`.

### Control

Disponible solo para admin en UI.

Incluye:

- Contadores por estado.
- Filtro por estado.
- Filtro por afiliador.
- Busqueda por DNI, nombre o apellido.
- Detalle administrativo.
- Boton para abrir la ficha completa del afiliado desde el detalle de Control.
- Historial de acciones con fecha/hora, operador y comentario cuando corresponde.
- Carga de ficha fisica.
- Marcado como cargado en JE.
- Aprobacion o error JE.
- Suspension, baja y reactivacion.
- Al suspender o dar de baja se puede cargar motivo opcional.
- Al reactivar una ficha suspendida o dada de baja se puede cargar comentario opcional.

Notas de auditoria:

- Baja y suspension quedan guardadas en campos especificos y en `historialControl`.
- Reactivacion queda guardada en `fechaReactivacion`, `reactivadoPor`, `reactivadoPorUid`, `reactivacionComentario` y en `historialControl`.
- El historial se ordena de mas reciente a mas antiguo.

## Exportaciones y descargas

`exportarCSV` arma un CSV de los registros visibles/filtrados con BOM UTF-8.

`descargarZip` descarga archivos vinculados a los registros visibles:

- Tipo `dni`: usa `archivoDni`.
- Tipo `ficha`: usa `archivoFicha`.
- Descarga en lotes de 10 para limitar concurrencia.
- Genera nombres con apellido, nombre, DNI y sufijo.

Nota: las funciones existen, pero revisar si tienen botones visibles en la UI actual antes de asumir que estan expuestas.

## APIs

### `POST /api/notificar`

Protegido por header:

```http
Authorization: Bearer ${API_SECRET_TOKEN}
```

Body esperado:

```json
{
  "email": "usuario@example.com",
  "nombre": "Nombre Apellido"
}
```

Envia email a `EMAIL_USER` con asunto de nuevo usuario.

### `POST /api/notificar-nuevo-usuario`

Protegido por Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

Valida el token contra Google Identity Toolkit usando `NEXT_PUBLIC_FIREBASE_API_KEY`.

Body esperado:

```json
{
  "email": "usuario@example.com",
  "nombre": "Nombre Apellido"
}
```

Si falla el envio de email, no bloquea el registro.

## Reglas de seguridad

Firestore:

- `usuarios`:
  - El propio usuario puede leer su doc.
  - Admin/supervisor pueden leer usuarios.
  - Cada usuario puede crear su propio doc.
  - Admin puede actualizar cualquier campo.
  - Supervisor puede editar y aprobar como afiliador, pero no asignar admin/supervisor.
  - El propio usuario puede actualizar su perfil sin cambiar rol.
  - Solo admin puede borrar usuarios.
- `afiliaciones`:
  - Afiliador lee sus fichas; admin/supervisor leen todo.
  - Usuarios activos (`admin`, `supervisor`, `afiliador`) pueden crear fichas con su propio UID.
  - Dueño, admin o supervisor pueden editar.
  - Admin/supervisor pueden borrar.

Storage:

- Usuarios autenticados pueden leer/escribir en `dnis/` y `fichas/`.
- Nadie puede borrar desde reglas.

## Consideraciones para futuros cambios

- `app/page.tsx` sigue concentrando la logica de datos y handlers, pero la UI principal ya esta separada en componentes presentacionales. Para cambios visuales, preferir tocar `app/components/*`; para cambios de datos o Firebase, revisar `page.tsx`.
- Hay texto con caracteres mal codificados en algunos archivos (`GestiÃ³n`, `NÃºmero`, etc.). Si se toca texto visible, corregir encoding de forma consistente.
- `useAuth.js` esta en JavaScript, no TypeScript.
- El modelo de datos no esta tipado formalmente; si se agregan campos, documentarlos y revisar reglas.
- Las reglas de Firestore son parte critica del sistema. Cambiar UI sin ajustar reglas puede dar errores de permisos.
- La UI usa estilos Tailwind inline. Seguir ese patron salvo que se haga una refactorizacion mayor.
- Al modificar rutas API con Next 16, leer docs locales de Next antes.
- Al trabajar con camara, probar en dispositivo real o navegador con permisos, porque desktop puede no reflejar el uso en campo.
- No hay tests automatizados; al cerrar cambios conviene correr `npm run lint` y `npx.cmd tsc --noEmit`. `npm run build` puede fallar localmente si faltan las variables `NEXT_PUBLIC_FIREBASE_*` porque Next intenta prerenderizar `/` e inicializa Firebase.

## Comportamiento esperado por rol

Para validar cambios manualmente:

1. Usuario nuevo:
   - Login con Google.
   - Completa nombre y apellido.
   - Queda en pantalla de acceso pendiente.
2. Admin/supervisor:
   - Entra a `Usuarios`.
   - Cambia rol de pendiente a afiliador.
3. Afiliador:
   - Carga nueva ficha.
   - Sube DNI con camara o archivo.
   - Ve la ficha en `Registros`.
4. Admin:
   - Ve la ficha en `Control`.
   - Sube ficha firmada.
   - Marca cargada en JE.
   - Aprueba o registra error.
5. Admin:
   - Puede suspender, dar de baja o reactivar segun el estado.
