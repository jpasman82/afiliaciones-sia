# Contexto de la aplicación — Afiliaciones SIA

Referencia técnica vigente del proyecto. Convive con `CLAUDE.md` (convenciones para agentes) y los ADRs en `docs/decisiones/` (decisiones arquitectónicas).

## Resumen funcional

Aplicación web para gestionar el proceso de afiliación a un partido político provincial argentino, desde la carga inicial hasta la aprobación por la Junta Electoral.

Originalmente construida para San Isidro Avanza (SIA, partido vecinal en formación, distrito San Isidro, Provincia de Buenos Aires). Diseñada para desplegarse como instancia independiente por cliente (ver `ADR-001-single-tenant.md`).

### Funcionalidades principales

- Autenticación con Google OAuth.
- Alta y aprobación de usuarios por rol.
- Carga de fichas de afiliados con datos personales, domicilio y documentación.
- Captura de DNI por cuatro vías: cámara (frente + dorso), archivo único (PDF o imagen), lectura del código PDF417 del DNI, y verificación online con Didit (extrae datos del DNI automáticamente).
- Generación de **links públicos efímeros** para que el afiliado cargue su propia ficha sin tener cuenta en la app.
- Listado, búsqueda, filtrado, detalle y edición de fichas.
- Módulo de control administrativo del estado de cada afiliación ante la JE provincial.
- Carga de ficha física firmada (escaneo o foto).
- Exportación a CSV y descarga masiva de DNIs o fichas en ZIP.
- Integración con bot de WhatsApp (proyecto externo) que crea fichas de tipo `contacto_bot`.

La app está pensada principalmente para mobile en campo, con vistas desktop para administración.

## Stack

- **Next.js 16.2.4** con App Router. Breaking changes respecto de versiones anteriores: **leer `node_modules/next/dist/docs/` antes de modificar código de Next**.
- **React 19.2.4**.
- **TypeScript** en `app/` (excepto `hooks/useAuth.js`, legado en JS).
- **Tailwind CSS 4**.
- **Firebase:**
  - Authentication (Google OAuth).
  - Firestore (base de datos).
  - Storage (DNIs y fichas físicas).
  - **App Check** opcional vía reCAPTCHA v3.
- **`firebase-admin`** del lado servidor (solo para escrituras críticas tras verificación de token).
- **Didit** para verificación de identidad y extracción de datos del DNI (free tier, 500 verificaciones/mes).
- **Nodemailer + Hostinger SMTP** (`smtp.hostinger.com:465`, dominio `sanisidroavanza.com.ar`) para notificaciones por email.
- **`sharp`** para combinación de imágenes en el webhook de Didit.
- **JSZip** para descargas masivas.
- **`jose`** y **`jwks-rsa`** para verificación de tokens en webhooks.

Deploy en Vercel. Reglas de Firestore y Storage se despliegan manualmente con Firebase CLI o Firebase Console.

## Comandos

```bash
npm run dev      # desarrollo
npm run build    # build de producción
npm run lint     # ESLint
npm start        # producción local tras build
```

No hay tests automatizados. Verificación: `npm run build` + smoke test en Vercel preview.

## Variables de entorno

`.env.local`:

```bash
# Firebase cliente
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (servidor)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# App Check (opcional, recomendado en producción)
NEXT_PUBLIC_APPCHECK_SITE_KEY=

# Email (Hostinger SMTP)
EMAIL_USER=
EMAIL_PASS=

# Didit
DIDIT_API_KEY=
DIDIT_WORKFLOW_ID=
DIDIT_WEBHOOK_SECRET=

# WhatsApp Cloud API (si aplica)
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

Notas:

- `EMAIL_PASS` es la contraseña de Hostinger del buzón, no del panel.
- `FIREBASE_ADMIN_PRIVATE_KEY` debe ir con los `\n` literales (Vercel los convierte).
- `DIDIT_WEBHOOK_SECRET` se usa para verificar la firma HMAC del webhook.
- **NO deben existir `API_SECRET_TOKEN` ni `NEXT_PUBLIC_API_SECRET_TOKEN`**. Eran variables legadas de un endpoint eliminado (MED-1).

## Estructura del proyecto

```
app/
  page.tsx                          ← componente principal (1500+ líneas, ver "Refactor pendiente")
  layout.tsx                        ← metadata, viewport, fuente
  globals.css                       ← Tailwind + estilos globales mínimos
  cargar/[token]/page.tsx           ← página pública para el flujo de link
  api/
    _auth.ts                        ← helper de verificación de ID token via Identity Toolkit
    afiliaciones/[id]/eliminar/route.ts ← borrado server-side de fichas y archivos
    notificar-nuevo-usuario/route.ts
    links-publicos/activo/route.ts  ← devuelve el link activo del afiliador
    link-publico/[token]/
      route.ts                      ← GET datos del link (afiliador, vencimiento)
      iniciar-sesion-didit/route.ts ← inicia sesión Didit asociada al link
      estado-didit/route.ts         ← polling del estado de la sesión
    renaper/                        ← nombre legacy; en realidad es Didit interno
      iniciar-sesion/route.ts
      estado/route.ts
      webhook/route.ts              ← webhook firmado de Didit (HMAC)
    whatsapp/webhook/route.ts       ← webhook de WhatsApp Cloud API
  components/
    shell/                          ← AppShell, Sidebar, TopBar, MobileNav
    auth/                           ← login y pantallas de perfil pendiente
    records/                        ← listado de fichas (RecordsView)
    ficha/                          ← formulario, detalle, escáner de código de barras
    control/                        ← módulo administrativo (ControlView)
    users/                          ← gestión de usuarios (UsuariosView)
    ui/                             ← primitivas (Button, Input, Icon, Card, etc.)
  lib/
    types.ts                        ← tipos compartidos
    estados.ts                      ← LOCALIDADES y mapeo de estados de control
    diditClient.ts                  ← cliente HTTP de Didit
    diditWebhook.ts                 ← verificación de firma HMAC del webhook
    firebaseAdmin.ts                ← inicialización de firebase-admin (lazy)
    decodeDniBarcode.ts             ← decodificación del PDF417 vía ZXing
    parseDniPdf417.ts               ← parseo del payload del PDF417
hooks/
  useAuth.js                        ← autenticación, rol, perfil (JS legado)
  useDiditSession.ts                ← gestión del ciclo Didit (start, poll, autocomplete)
firebaseConfig.js                   ← inicialización Firebase cliente + App Check
firestore.rules                     ← reglas de Firestore (NO se deploya con Vercel)
storage.rules                       ← reglas de Storage (idem)
firebase.json                       ← config de Firebase CLI
public/
  logo.png
  video.mp4                         ← intro/splash inicial
  manifest.json                     ← PWA
```

## Arquitectura general

Single-page React app con tres capas:

1. **Cliente Firebase directo:** la mayor parte de las lecturas y escrituras se hacen desde el cliente vía SDK de Firebase con `onSnapshot` para tiempo real. Las reglas de Firestore son la principal defensa.

2. **Endpoints serverless de Next** (`app/api/*`) para:
   - Verificación de ID tokens de Firebase (vía Identity Toolkit, ver `_auth.ts`).
   - Notificaciones por email.
   - Integración con Didit (inicio de sesión, polling de estado, webhook firmado).
   - Webhook de WhatsApp.

3. **Firebase Storage** para archivos pesados (DNIs y fichas físicas).

`app/page.tsx` es un `'use client'` que concentra estado y handlers de los flujos privados (afiliador autenticado, admin, supervisor). `app/cargar/[token]/page.tsx` es el flujo público (no autenticado).

Navegación entre tabs vía `useState` + `history.pushState` / `popState` para que el botón "atrás" del navegador funcione.

## Autenticación y perfil

`hooks/useAuth.js`:

1. `onAuthStateChanged` mantiene la sesión.
2. Login con `signInWithPopup` (Google únicamente).
3. Escucha `usuarios/{uid}` en tiempo real.
4. Si el doc no existe en el primer login, lo crea con `rol: 'pendiente'`, `perfilCompleto: false`.

Flujo de primer ingreso:

1. Login con Google → se crea doc en `usuarios`.
2. Si `perfilCompleto: false`, UI pide nombre y apellido.
3. Al completar, se actualiza el doc y se llama a `/api/notificar-nuevo-usuario` con el ID token de Firebase.
4. Admin o supervisor aprueban desde la vista "Usuarios".

### Endpoints autenticados: `app/api/_auth.ts`

Helper compartido para verificar ID tokens del lado servidor. **No usa `firebase-admin.auth().verifyIdToken()`** debido a problemas en el entorno serverless de Vercel. En su lugar, hace un POST a Google Identity Toolkit (`accounts:lookup`) que valida la firma del token y devuelve los datos del usuario. Funcionalmente equivalente, sin la dependencia compleja.

Devuelve `{ user, role }`. Si el token es inválido, expirado o el usuario no existe, devuelve error y la ruta termina con 401.

`firebase-admin` sí se usa para escrituras críticas server-side (ver `app/lib/firebaseAdmin.ts`). La inicialización es lazy y singleton.

## Roles

Cuatro roles, almacenados en `usuarios/{uid}.rol`:

- **`pendiente`**: registrado, sin acceso operativo. UI muestra pantalla de "acceso pendiente".
- **`afiliador`**: carga fichas propias. Solo ve sus propias fichas en el listado.
- **`supervisor`**: ve todas las fichas, puede editarlas, gestiona usuarios con limitaciones (solo asigna/revoca `afiliador`, no toca `admin` o `supervisor`).
- **`admin`**: acceso completo. Único con acceso al módulo Control.

Permisos resumidos:

| Acción | Afiliador | Supervisor | Admin |
|---|---|---|---|
| Crear ficha propia | ✓ | ✓ | ✓ |
| Ver fichas propias | ✓ | ✓ | ✓ |
| Ver todas las fichas | ✗ | ✓ | ✓ |
| Editar ficha propia (estados tempranos) | ✓ | ✓ | ✓ |
| Editar ficha en estados avanzados | ✗ | ✗ | ✓ |
| Generar link público | ✓ | ✓ | ✓ |
| Gestionar usuarios | ✗ | parcial | ✓ |
| Asignar rol `admin` o `supervisor` | ✗ | ✗ | ✓ |
| Borrar fichas | ✗ | ✓ | ✓ |
| Módulo Control | ✗ | ✗ | ✓ |

## Modelo de datos (Firestore)

### `usuarios/{uid}`

```
email: string
nombre: string
apellido: string
rol: 'pendiente' | 'afiliador' | 'supervisor' | 'admin'
perfilCompleto: boolean
fechaRegistro: timestamp
```

### `afiliaciones/{autoId}`

Datos personales:
```
tipoDocumento: 'DNI' | 'LE' | 'LC'
dni: string
apellidos: string
nombres: string
sexo: 'Masculino' | 'Femenino'
clase: string                       ← año de nacimiento (4 dígitos)
fechaNacimiento: string             ← formato 'DD/MM/AAAA'
lugarNacimiento: string
nacionalidad: string
profesion: string
estadoCivil: string
celular: string
mail: string
```

Domicilio:
```
distrito: string                    ← 'Buenos Aires' fijo (hoy)
localidad: string                   ← Acassuso | Beccar | Boulogne | Martínez | San Isidro | Villa Adelina
calle: string
numero: string
piso: string
dpto: string
observaciones: string
```

Archivos:
```
archivoDni: string                  ← URL de Storage (o URL pública si vino de Didit — ver MED-1 en seguridad)
archivoDniPath: string              ← path de Storage (preferir este sobre archivoDni)
archivoFicha: string                ← URL de la ficha física firmada
archivoFichaPath: string
```

Autoría y origen:
```
afiliadorNombre: string
afiliadorEmail: string
afiliadorUid: string
fecha: timestamp                    ← creación
ultimaModificacion: timestamp       ← (campo con encoding heredado, ver "Gotchas")
origen: 'manual' | 'link_publico' | 'contacto_bot'
linkToken: string                   ← presente si origen == 'link_publico'
```

Estado de control:
```
estadoControl: 'pendiente' | 'firmado' | 'escaneado' | 'cargado_je' |
               'aprobado' | 'error' | 'suspendido' | 'baja'
fechaFirma, firmadoPor, firmadoPorUid
fechaEscaneado, escaneadoPor, escaneadoPorUid
fechaCargadoJE, cargadoJEPor, cargadoJEPorUid
fechaAprobacion
fechaError, errorJE, resueltoJEPor, resueltoJEPorUid
editadoPorAdmin, fechaEdicionAdmin, estadoAnterior
fechaSuspension, suspendidoPor, suspendidoPorUid, suspendidoComentario
fechaReactivacion, reactivadoPor, reactivadoPorUid
```

### `dniIndex/{dni}`

Índice de unicidad de DNI. Doc con ID = el número de DNI. Contiene `{ fichaId, creadoEn }`. Las reglas de Firestore exigen que se cree atómicamente junto con la ficha. **`eliminarFicha` debe borrar también el doc de `dniIndex`**, si no, re-cargar ese DNI queda bloqueado.

### `linksCargaPublica/{token}`

Token efímero para el flujo público de carga.

```
afiliadorUid: string
afiliadorNombre: string
afiliadorEmail: string
creadoEn: timestamp
venceEn: timestamp                  ← creadoEn + 24h
usado: boolean
revocado: boolean                   ← opcional, true si se generó un reemplazo
```

El `token` es de 32 caracteres hex (`crypto.randomUUID()` sin guiones, 128 bits).

### `sesionesDidit/{localId}`

Sesiones de verificación con Didit.

```
sessionId: string                   ← localId que generamos nosotros (UUID v4)
diditSessionId: string              ← id de Didit
status: string                      ← 'In Progress' | 'Approved' | 'Declined' | ...
vendorData: { afiliadorUid, afiliadorNombre, linkToken?, ... }
datosExtraidos: {                   ← cuando status == 'Approved'
  dni, apellidos, nombres, sexo, fechaNacimiento, nacionalidad, lugarNacimiento,
  domicilio: { calle, numero, piso, dpto, localidad },
  dniImageStoragePath, frontImageStoragePath, backImageStoragePath
}
procesada: boolean                  ← solo true en estados finales
creadoEn, ultimaActualizacion
```

## Estados de control

`estadoControl` y su transición típica:

```
pendiente   ← ficha digital cargada, falta ficha física
   ↓
escaneado   ← admin subió foto/escaneo de la ficha firmada
   ↓
cargado_je  ← admin la cargó en la web de la JE provincial
   ↓
aprobado    ← JE devolvió aprobación
   ↓ (alternativa)
error       ← JE devolvió un error, se guarda detalle en errorJE
```

Estados terminales adicionales: `suspendido` y `baja`, accesibles desde estados avanzados. `reactivacion` vuelve a un estado anterior.

(El estado `firmado` está definido pero el flujo actual normalmente salta de `pendiente` a `escaneado`.)

## Storage

Reglas en `storage.rules`. Paths usados:

- `dnis/{ownerUid}/{fileName}` — DNIs cargados internamente. Solo dueño + admin/supervisor leen.
- `dnis/{fileName}` (legacy) — DNIs cargados antes de la separación por owner. Solo admin/supervisor leen.
- `dnis/{dni}-didit-*.jpg` — DNIs procesados por el webhook de Didit. **Hoy se marcan como públicos (`makePublic`), lo cual es un problema de seguridad activo** (ver CRIT-1 en `docs/seguridad/`).
- `dnisPublicos/{token}/{fileName}` — DNIs subidos vía link público (sin autenticación). Validación: link `usado == false`, `venceEn > now`, tamaño < 5MB, contentType JPEG.
- `fichas/{docId}/{fileName}` — fichas físicas firmadas. Solo admin escribe, admin/supervisor leen.

## Captura de documentos

### Cámara nativa (modo escaneo)

Componente `EscanerDocumento` dentro de `app/page.tsx` (líneas 1–397, candidato a extraer).

- Usa `<input type="file" capture="environment" accept="image/*">` para abrir la cámara nativa del dispositivo.
- **NO usa `getUserMedia` + video** (se intentó, fallaba en resoluciones bajas).
- Captura frente y dorso por separado.
- Permite recortar usando un marco visual ajustable.
- Combina frente + dorso verticalmente en un JPEG único.
- **Downscale obligatorio a ~2200px max antes de procesar.** Las cámaras de celulares modernos entregan resoluciones que crashean al pasarlas por múltiples canvas.

### Lectura del código PDF417

`app/lib/decodeDniBarcode.ts` y `app/lib/parseDniPdf417.ts`. Decodifica el código de barras del dorso del DNI argentino con ZXing y parsea el payload para extraer apellido, nombre, DNI, sexo, fecha de nacimiento, CUIL.

Si la lectura automática falla, hay un escáner manual (componente `EscanerCodigoBarras`) donde el usuario marca el área del código.

### Verificación con Didit

Ver sección "Integración Didit" más abajo.

### Archivo único (PDF o imagen)

- DNI: acepta `application/pdf`, `image/jpeg`, `image/png`.
- Para PDF: renderiza páginas con PDF.js. Si tiene 1 página, la muestra dos veces para que el usuario recorte frente y dorso. Si tiene 2+, usa las primeras dos.
- Para imagen: idem que 1 página de PDF.

## Integración Didit

Didit es un proveedor de verificación de identidad. Se usa en dos lugares:

1. **Flujo interno** (afiliador autenticado): el afiliador toca "Escanear automáticamente" en el formulario, se abre la ventana hosted de Didit, el afiliando escanea su DNI, Didit envía un webhook con los datos extraídos, la app autocompleta el formulario.

2. **Flujo público** (link de carga): idem, pero iniciado desde `/cargar/[token]` sin autenticación. La sesión queda asociada al `linkToken` en `vendorData`.

### Componentes técnicos

- **`hooks/useDiditSession.ts`** — gestiona el ciclo de vida de la sesión:
  - Inicia la sesión via API (`/api/renaper/iniciar-sesion` o `/api/link-publico/[token]/iniciar-sesion-didit`).
  - Abre la ventana hosted de Didit.
  - Hace polling de estado vía `/api/renaper/estado` (o equivalente público).
  - Persiste el `sessionId` en `localStorage` con clave `didit_session_pendiente:{contexto}` por si el redirect-back falla.
  - Cuando llega `Approved`, llama a un callback que autocompleta el formData.

- **`app/api/renaper/iniciar-sesion/route.ts`** — crea una sesión Didit y persiste un doc en `sesionesDidit`. El nombre `renaper` es legado (la integración real es Didit; cuando se apruebe la afiliación electrónica se reemplazará el workflow de Didit por uno conectado a RENAPER).

- **`app/api/renaper/webhook/route.ts`** — recibe webhooks de Didit firmados con HMAC. Verifica firma + timestamp. Si la sesión está aprobada, descarga las imágenes de DNI (`front_image`, `back_image`), las combina con `sharp`, las sube a Storage en `dnis/{dni}-didit-*.jpg`, y persiste los datos extraídos en `sesionesDidit/{localId}`.

- **`app/lib/diditWebhook.ts`** — verificación de firma HMAC del webhook con `crypto.timingSafeEqual`.

- **`app/lib/diditClient.ts`** — cliente HTTP para llamar la API de Didit (crear sesión, obtener estado).

### Gotchas conocidos de Didit

- **Idempotencia:** marcar la sesión como `procesada: true` solo en estados finales (`Approved`, `Declined`). Si se marca antes, webhooks posteriores se descartan y se pierde data.
- **`parsed_address` viene vacío** en DNIs argentinos. Hay que parsear el campo `address` libre (formato `calle número - localidad`). Helper: `parsearAddressLibre()` que splittea por ` - `.
- **Redirect-back inestable.** Después de completar el flow, Didit a veces no redirige a la app. Workaround: localStorage + polling. Bug reportado, sin ETA.

## Link público de carga

Flujo paralelo al privado para que el afiliando cargue su propia ficha sin tener cuenta.

1. El afiliador (autenticado) genera un link desde el formulario de nueva ficha. Se crea un doc en `linksCargaPublica/{token}` con `crypto.randomUUID()` (128 bits).
2. El link es `https://app.../cargar/{token}`. Comparte por WhatsApp o copia.
3. El afiliando abre el link → `app/cargar/[token]/page.tsx`.
4. Carga DNI (via Didit, cámara, archivo o código de barras) y completa el formulario.
5. Al enviar, crea la ficha con `origen: 'link_publico'`, `afiliadorUid` del link, y marca `linksCargaPublica/{token}.usado = true` atómicamente.

Validaciones críticas en `firestore.rules`:

- El link debe existir y no estar usado al momento de crear.
- El link debe quedar `usado: true` después de la creación (`getAfter`).
- El path del archivo de DNI debe matchear el patrón esperado (`dnisPublicos/{token}/...` o `dnis/{dni}-didit-...`).
- El `dniIndex` se crea atómicamente con la ficha.

Vencimiento: 24 horas. Un solo uso.

## Bot de WhatsApp

Proyecto separado (no en este repo) que comparte la misma instancia de Firebase. Es un bot que recibe mensajes de personas interesadas en afiliarse vía WhatsApp Cloud API. Cuando se completa el flow conversacional, crea un doc en `afiliaciones` con `origen: 'contacto_bot'`.

En este repo solo vive `app/api/whatsapp/webhook/route.ts`, que:

- Responde al GET de verificación (`hub.mode=subscribe`, `hub.verify_token`).
- Recibe el POST con mensajes entrantes, verifica firma HMAC con `WHATSAPP_APP_SECRET`.
- Persiste los mensajes en Firestore para que el bot externo los procese.

(En proceso de surfaceo en la UI principal: los `contacto_bot` deberían aparecer en el listado de fichas con un filtro propio.)

## APIs

| Endpoint | Auth | Propósito |
|---|---|---|
| `POST /api/afiliaciones/[id]/eliminar` | Firebase ID token | Borra ficha, DNI/ficha física y `dniIndex`; admin siempre, supervisor/afiliador solo si está pendiente |
| `POST /api/notificar-nuevo-usuario` | Firebase ID token | Notifica al admin que se registró un usuario nuevo |
| `GET /api/links-publicos/activo` | Firebase ID token | Devuelve el link público activo del afiliador (si existe) |
| `GET /api/link-publico/[token]` | Ninguna | Devuelve info del link (afiliador, vencimiento) |
| `POST /api/link-publico/[token]/iniciar-sesion-didit` | Ninguna (valida token) | Inicia sesión Didit asociada al link |
| `GET /api/link-publico/[token]/estado-didit?session_id=…` | Ninguna (valida token + session) | Polling de estado |
| `POST /api/renaper/iniciar-sesion` | Firebase ID token | Inicia sesión Didit (flujo interno) |
| `GET /api/renaper/estado?session_id=…` | Firebase ID token | Polling de estado (flujo interno) |
| `POST /api/renaper/webhook` | HMAC firmado por Didit | Webhook de finalización de sesión |
| `GET/POST /api/whatsapp/webhook` | Verify token + HMAC | Webhook de WhatsApp Cloud API |

## Reglas de seguridad

### Firestore (`firestore.rules`)

- **`usuarios`:** el propio usuario lee/actualiza su perfil (sin tocar rol). Admin/supervisor leen todos. Admin actualiza cualquier campo. Supervisor solo asigna `afiliador` o `pendiente`. Solo admin borra.

- **`afiliaciones`:**
  - Lectura: dueño + admin/supervisor.
  - Creación autenticada: `creacionFichaValida()` — requiere `afiliadorUid == auth.uid`, rol activo, campos válidos, `dniIndex` creado atómicamente.
  - Creación pública (sin auth): `creacionFichaPublicaValida()` — requiere `origen == 'link_publico'`, link válido y consumido atómicamente, path de DNI matchea patrones esperados.
  - Edición: dueño en estados tempranos, admin siempre, supervisor para fichas pendientes.
  - Borrado: admin y supervisor.

- **`linksCargaPublica`:** creación solo autenticada. Lectura pública si `usado == false && revocado != true && venceEn > now`. Actualización pública solo para marcar usado en la misma transacción que crear la ficha; revocación autenticada por el dueño.

- **`sesionesDidit`:** creación y actualización solo desde Admin SDK (server-side).

- **`dniIndex`:** creación atómica junto con la ficha. Borrado al eliminar la ficha.

### Storage (`storage.rules`)

Detalle en sección "Storage" arriba.

### Despliegue de reglas

**No se deploya con Vercel.** Hay que correr manualmente:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

O usar Firebase Console (Reglas → publicar).

**Este es el paso más fácil de olvidar al hacer fixes de seguridad.** Considerar GitHub Actions para automatizar.

## Comportamiento esperado por rol (validación manual)

1. **Usuario nuevo:**
   - Login con Google.
   - Completa nombre y apellido.
   - Queda en pantalla "Acceso pendiente".

2. **Admin o supervisor:**
   - En "Usuarios", aprueba al usuario nuevo asignando `afiliador`.

3. **Afiliador:**
   - Carga nueva ficha.
   - Sube DNI por cualquiera de los 4 métodos.
   - O genera link público y lo comparte por WhatsApp.
   - Ve sus fichas en "Registros".

4. **Admin:**
   - En "Control", ve la ficha en `pendiente`.
   - Sube ficha física firmada → `escaneado`.
   - Marca "Cargada en JE" → `cargado_je`.
   - Marca `aprobado` o registra `error`.
   - Si necesario, suspende, da de baja o reactiva.

## Gotchas adicionales

- **Encoding heredado:** algunos campos tienen caracteres mal codificados en su nombre (ej. `ultimaModificaciÃ³n`). Si se toca código que los lee, conservar el encoding mojado para no romper datos existentes. Idealmente, migrar con script + actualizar todas las lecturas en el mismo PR.
- **`hasOnly()` en reglas:** agregar un campo al payload sin actualizar la lista de `hasOnly()` rompe todas las escrituras de la colección. Coordinar cambios payload + rules.
- **Firestore collections implícitas:** borrar todos los docs de una colección no la elimina; un `addDoc` nuevo la recrea. Sirve para limpiezas manuales sin scripts.
- **`useAuth.js` en JS, no TS:** legado. Si se reescribe, mejor migrar a TS.

## Refactor pendiente

- **`app/page.tsx` tiene 1500+ líneas.** Concentra el componente `EscanerDocumento` (~400 líneas, candidato a extraer), 40+ `useState`, y 12+ handlers async grandes. División tentativa registrada en `docs/decisiones/` (cuando se prepare).
- **Branding sin extraer.** Logo, color, nombre, dominio email, localidades, distrito hardcoded en varios archivos. Extracción a `app/lib/branding.ts` y `app/lib/config.ts` es trabajo barato y necesario para soportar el segundo cliente (ver `ADR-001-single-tenant.md`).

## Trabajo en curso o backlog

- **Seguridad** (ver `docs/seguridad/seguridad-sia.md`): hay un crítico (CRIT-1) y varios altos abiertos.
- **Surfaceo de `contacto_bot`** en la UI principal con filtro propio.
- **Extracción de branding y constantes a `app/lib/`** preparatorio para multi-cliente.
- **Refactor de `app/page.tsx`** (no urgente, hacer después de cerrar seguridad).
- **Migración del nombre del módulo "renaper"** (legacy, hoy es Didit) a algo más correcto.
