# Auditoría de seguridad — Afiliaciones SIA

> Revisión sobre `afiliaciones-sia-main` al 24/06/2026.
> Cada ítem tiene: archivo afectado, problema, impacto, fix concreto.
> Los IDs (CRIT-N, HIGH-N, etc.) son estables: usalos para trackear progreso.

---

## 🔴 CRÍTICO

### CRIT-1 — Las fotos de DNI del flujo Didit quedan **públicas en internet**

**Archivo:** `app/api/renaper/webhook/route.ts` (líneas 171 y 204).

```ts
await file.makePublic();
```

**Problema:** `makePublic()` setea ACL público en GCS. Las reglas de Storage **no aplican** a objetos públicos. La URL queda guardada en Firestore (`archivoDni`, `dniImageStorageUrl`, `frontImageStorageUrl`, `backImageStorageUrl`) y se devuelve por `/api/link-publico/[token]/estado-didit` y `/api/renaper/estado`.

**Impacto:** Cualquiera con la URL puede bajar la foto del DNI (nombre, dirección, rostro, número de trámite, a veces firma). El path es predecible: `dnis/{dni}-didit-{timestamp}.jpg`. Conociendo un DNI y la fecha, la enumeración por timestamp es factible. Además: probable incumplimiento de Ley 25.326 (AAIP).

**Fix:**

1. Borrar las llamadas a `file.makePublic()`.
2. Cambiar el path a `dnis/{afiliadorUid}/{dni}-didit-{timestamp}.jpg`. Sacar `afiliadorUid` de `vendorData.afiliadorUid`. Eso matchea la regla de Storage `dnis/{ownerUid}/{fileName}` y el dueño puede leer con SDK + `getBlob`.
3. No guardar URL pública en `dniImageStorageUrl` / `archivoDni`. Guardar solo el `path`. `FichaDetalle.tsx` ya usa `getBlob(ref(storage, path))`, funciona out-of-the-box.
4. **Script de saneamiento (una sola vez):**
   - Iterar `afiliaciones` con `archivoDni` que empiece por `https://storage.googleapis.com/`.
   - Para cada blob: `file.acl.delete({entity: 'allUsers'})`.
   - Mover el archivo a `dnis/{afiliadorUid}/...` y actualizar el doc con el nuevo `archivoDniPath`, borrar `archivoDni`.

---

## 🟠 ALTOS

### HIGH-1 — Logs con PII en endpoints de servidor ✅ Resuelto en PR fix/high-1-2-3-server-hardening el 25/06/2026

**Archivos:**
- `app/api/renaper/iniciar-sesion/route.ts` líneas 17–36, 52, 72, 88.
- `app/api/_auth.ts` línea 74.

**Problema:** `console.log` con `uid`, `email`, `role`, `Firebase project`. Va a logs de Vercel; cualquiera con acceso al proyecto los ve.

**Fix aplicado:** se eliminaron todos los `console.log` de diagnóstico. Solo queda `console.error` con mensaje genérico (sin PII) en `catch`.

---

### HIGH-2 — `afiliadorUid` viene del body sin verificarse contra el token ✅ Resuelto en PR fix/high-1-2-3-server-hardening el 25/06/2026

**Archivo:** `app/api/renaper/iniciar-sesion/route.ts` líneas 41–54.

**Problema:**

```ts
({ afiliadorUid, afiliadorNombre } = body as ...);
// Se usa afiliadorUid sin chequear que == auth.user.uid
```

Un afiliador autenticado puede iniciar Didit "a nombre de" otro afiliador. La sesión y `vendorData` quedan mal atribuidas. Las reglas de Firestore protegen la creación de la ficha, pero si en el futuro lógica server-side usa `vendorData.afiliadorUid` (contadores de productividad, asignación automática, etc.), se puede spoofear.

**Fix aplicado:** `afiliadorUid` se toma de `auth.user.uid` (token). `afiliadorNombre` se lee de `adminDb.collection('usuarios').doc(uid).get()`. El body ya no es necesario para estos campos (el cliente sigue enviándolos por ahora, pero el servidor los ignora).

---

### HIGH-3 — `/api/renaper/estado` no verifica que la sesión sea del usuario ✅ Resuelto en PR fix/high-1-2-3-server-hardening el 25/06/2026

**Archivo:** `app/api/renaper/estado/route.ts`.

**Problema:** Solo chequea `rolActivo` y que exista la sesión. Cualquier afiliador que conozca el `localId` de otro lee los datos extraídos del DNI. `localId` es UUID v4, no se adivina, **pero queda en `localStorage`, URL del callback, history del browser y posibles logs**.

**Fix aplicado:** se agregó chequeo `vendorData.afiliadorUid !== auth.user.uid` → 404 (mismo mensaje que "no existe", indistinguible para el atacante).

---

## 🟡 MEDIOS

### MED-1 — `/api/notificar` es código muerto pero sigue expuesto

**Archivo:** `app/api/notificar/route.ts`.

**Problema:** Nadie lo llama (grep confirmó). Si `NEXT_PUBLIC_API_SECRET_TOKEN` quedó en el bundle del cliente (la doc lo menciona), cualquiera con el token manda emails desde la cuenta SIA.

**Fix:** borrar `app/api/notificar/route.ts` y la variable `NEXT_PUBLIC_API_SECRET_TOKEN` de Vercel + `.env.local`. Eliminar la línea en `APP_CONTEXT.md` y `CLAUDE.md`.

---

### MED-2 — `/api/notificar-usuario-aprobado` sin uso ni validación

**Archivo:** `app/api/notificar-usuario-aprobado/route.ts`.

**Problema:** Ningún componente lo llama. Si se llamara, `to: email` viene del body sin validar contra `usuarios/{uid}`. Admin/super podría mandar el template a cualquier email.

**Fix:** o lo cableás desde el cambio de rol (faltaba el call) **validando que `email` corresponda a un doc real en `usuarios`**, o lo borrás.

---

### MED-3 — Datos de Didit siguen consultables después de consumir el link

**Archivo:** `app/api/link-publico/[token]/estado-didit/route.ts`.

**Problema:** No chequea si `linksCargaPublica/{token}.usado == true`. Token + session_id permiten seguir leyendo `datosExtraidos` del DNI semanas después. Ambos quedan en history del afiliando.

**Fix:**
- Después de crear la ficha, borrar `datosExtraidos` (o todo el doc) de `sesionesDidit` cuyo `vendorData.linkToken` matchee.
- O agregar `if (linkSnap.data().usado) return new Response('Gone', { status: 410 })` al inicio del handler.

---

### MED-4 — SSRF teórico en el webhook Didit

**Archivo:** `app/api/renaper/webhook/route.ts` líneas 155–164.

**Problema:** `await fetch(idv.front_image)` sin validar el host. El payload está firmado, así que solo Didit (o Didit comprometido) puede inyectar URLs. Riesgo bajo en práctica, pero un fetch a metadata interna o IP privada podría escalarse.

**Fix:** validar que la URL empiece con `https://` y que el host esté en una whitelist conocida de Didit (verificar en su doc qué dominios usan para `idv.front_image` / `back_image`).

---

### MED-5 — TODO sin resolver en validación del webhook Didit

**Archivo:** `app/lib/diditWebhook.ts` línea 27.

```ts
// TODO: verificar unidad real del header X-Timestamp de Didit.
```

**Problema:** Si la unidad es ms en vez de segundos (o viceversa), el chequeo de tolerancia (5 min) no funciona y un replay con body firmado viejo se acepta.

**Fix:** confirmar contra docs de Didit qué unidad usan, ajustar el cálculo, sacar el TODO. Cubrir con un test manual: tomar un webhook real, manipular el `X-Timestamp` a una hora atrás, confirmar que se rechaza.

---

### MED-6 — Regenerar link público deja huérfano el anterior (24h)

**Archivos:** `app/components/ficha/FichaForm.tsx` (botón "Generar otro" línea 494) y `app/page.tsx` (handler `onCrearPublicLink`).

**Problema:** Cuando el afiliador toca "Generar otro", se crea un doc nuevo en `linksCargaPublica` pero el anterior queda `usado: false` hasta que venza. Consecuencias:

1. El afiliando puede tener el link viejo y completar la afiliación con él durante las 24h. Posible doble carga si el afiliador asume que solo vale el último.
2. Se acumulan docs huérfanos en Firestore.

**Fix:** antes de crear el link nuevo, marcar el anterior como `revocado: true` (o `usado: true` con `motivo: 'regenerado'`).

Pasos:

1. Agregar campo opcional `revocado: boolean` a la regla de `linksCargaPublica` en `firestore.rules`.
2. En la condición `get` del link público (`creacionFichaPublicaValida` y endpoint API), exigir `resource.data.revocado != true`.
3. En `onCrearPublicLink` de `page.tsx`: antes del `setDoc` nuevo, si hay `publicLink` activo en estado, hacer `updateDoc` del anterior con `revocado: true, revocadoEn: serverTimestamp()`.

---

## 🟢 BAJOS / informativos

### LOW-1 — Email del afiliador expuesto en endpoint público del link

**Archivo:** `app/api/link-publico/[token]/route.ts`.

Cualquiera con el token ve `afiliadorEmail`. Si solo mostrás el nombre en la página pública, sacalo del JSON de respuesta.

---

### LOW-2 — Sin rate limiting

Ningún endpoint tiene throttling: spam de mails, polling de `/estado`, upload a `dnisPublicos/` durante 24h, generación de links. Sugerencia: Vercel Edge Middleware con rate limit por IP, o Cloudflare delante.

---

### LOW-3 — Comparaciones no constant-time

- `app/api/notificar/route.ts` línea 8.
- WhatsApp `verify_token` línea 28.

Bajo riesgo. Usar `crypto.timingSafeEqual()` por buena práctica.

---

### LOW-4 — App Check opcional en cliente

**Archivo:** `firebaseConfig.js` línea 18.

Si `NEXT_PUBLIC_APPCHECK_SITE_KEY` no está seteado en producción, las reglas de Firestore son la única defensa contra abuso del SDK desde fuera del browser legítimo. Confirmar que esté seteado en Vercel.

---

### LOW-5 — Service account con permiso elevado de IAM en bucket

Para que `makePublic()` funcione, el SA de Firebase Admin tiene `storage.objects.setIamPolicy` (o equivalente). Después de resolver CRIT-1, bajar el rol del SA a `storage.objectAdmin` y revocar permisos de IAM sobre objetos.

---

### LOW-6 — `localStorage` para `didit_session_pendiente`

Si en algún momento entra XSS, el atacante puede leer el sessionId y consultar `/estado-didit` o `/api/renaper/estado` con él. No hay vector de XSS hoy, pero algo a tener en cuenta cuando agregues HTML dinámico (markdown del WhatsApp bot, contenido de fichas en email, etc.).

---

## ✅ Lo que está bien

Para contexto — varias cosas ya están muy sólidas y NO requieren acción:

- Reglas de Firestore granulares con `hasOnly()`, atomicidad vía `dniIndex`, separación creación pública vs autenticada, patrón `getAfter()` para garantizar consistencia atómica link+ficha+índice.
- Reglas de Storage per-owner (`dnis/{ownerUid}`), límite de tamaño y content-type en `dnisPublicos/`.
- Webhook Didit con firma HMAC + timestamp + `timingSafeEqual`.
- WhatsApp webhook con firma HMAC.
- Tokens de link público de 128 bits (`crypto.randomUUID`).
- Idempotencia del webhook (solo salta en estados finales).

---

## Plan de remediación por etapas

Cada etapa es independiente, ejecutable por un agente sin contexto de la anterior.

### Etapa 1 — Hoy (1 PR)

- **CRIT-1**: parchar `makePublic()`, cambiar paths a per-owner, correr script de saneamiento sobre datos existentes.

### Etapa 2 — Esta semana (1 PR)

- **HIGH-1**: sacar logs con PII.
- **HIGH-2**: `afiliadorUid` siempre desde `auth.user.uid`.
- **HIGH-3**: filtrar `/api/renaper/estado` por afiliador.

### Etapa 3 — Antes de escalar el flow público (1 PR)

- **MED-3**: cerrar `/estado-didit` post-uso.
- **MED-6**: revocar link viejo al regenerar.
- **MED-1**: borrar `/api/notificar` + variable pública.
- **MED-2**: decidir borrar o cablear `/notificar-usuario-aprobado` con validación.

### Etapa 4 — Backlog (cuando se pueda)

- **MED-4**: whitelist de hosts en webhook.
- **MED-5**: resolver TODO del timestamp.
- **LOW-1 a LOW-6**: hardening.
