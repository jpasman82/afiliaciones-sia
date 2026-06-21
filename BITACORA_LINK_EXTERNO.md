# Bitacora - Link externo de carga de ficha

Fecha: 20/06/2026

## Objetivo

Se agrego un flujo para que un afiliador pueda generar un link externo temporal y de un solo uso. Ese link permite que una persona sin necesidad de iniciar sesion cargue una ficha completa, adjunte DNI frente/dorso y que la ficha quede registrada a nombre del afiliador que genero el link.

## Comportamiento esperado

- El afiliador logueado genera un link desde la pantalla de nueva ficha.
- El link apunta a `/cargar/[token]`.
- El link vence a las 24 horas.
- El link se puede usar una sola vez.
- La persona que abre el link puede cargar los datos de la ficha.
- Puede subir DNI frente y dorso con camara o archivo.
- Puede subir archivo unico, incluyendo PDF o imagen.
- Si el archivo unico tiene una pagina, se muestra dos veces para recortar frente y dorso.
- Si el archivo unico tiene dos paginas, se usa pagina 1 como frente y pagina 2 como dorso.
- Si tiene mas paginas, se usan solo las dos primeras.
- Las imagenes se recortan antes de guardarse.
- Se intenta leer el codigo PDF417 del DNI.
- Si no se lee automaticamente, se puede marcar manualmente el area del codigo de barras.
- La ficha queda asociada al `afiliadorUid`, `afiliadorEmail` y `afiliadorNombre` del link.

## Archivos modificados o agregados

### `app/page.tsx`

Se agrego la funcion `generarLinkCargaPublica`.

Responsabilidades:

- Generar un token aleatorio.
- Crear un documento en `linksCargaPublica`.
- Guardar:
  - `afiliadorUid`
  - `afiliadorEmail`
  - `afiliadorNombre`
  - `creadoEn`
  - `venceEn`
  - `usado: false`
- Construir la URL publica `/cargar/{token}`.
- Mostrar/copiar el link generado.

Tambien se agrego un mensaje de diagnostico si falla la creacion del link, mostrando UID, rol y email del usuario.

### `app/components/ficha/FichaForm.tsx`

Se adapto el formulario compartido para soportar el modo publico.

Cambios:

- Props nuevas:
  - `publicLink`
  - `creandoPublicLink`
  - `onCrearPublicLink`
  - `hideBackButton`
  - `hideCancelButton`
  - `submitLabel`
- Boton para generar link publico en la pantalla interna.
- En modo publico se ocultan:
  - boton superior `Volver`
  - boton inferior `Cancelar`
- En modo publico el submit puede decir `Enviar ficha`.
- El boton de reintentar lectura del codigo de barras se muestra cuando hay una foto de DNI cargada.

### `app/cargar/[token]/page.tsx`

Archivo nuevo.

Pantalla publica del link externo.

Responsabilidades:

- Validar el token contra `linksCargaPublica`.
- Bloquear el flujo si el link no existe, vencio o fue usado.
- Mostrar el formulario de ficha sin login.
- Permitir cargar frente/dorso con camara o archivo.
- Permitir archivo unico en imagen o PDF.
- Renderizar PDFs a imagen para recortar.
- Mostrar recortador para frente y dorso.
- Intentar leer automaticamente el PDF417.
- Permitir reintento manual con `EscanerCodigoBarras`.
- Combinar frente y dorso en un JPG unico.
- Subir el JPG a Storage en `dnisPublicos/{token}/...`.
- Crear en un mismo batch:
  - documento en `dniIndex/{dni}`
  - documento en `afiliaciones/{fichaId}`
  - update de `linksCargaPublica/{token}` marcando `usado: true`

Se agrego diagnostico de error por paso:

- `preparar imagen`
- `subir DNI`
- `guardar ficha`

Esto permite saber si el bloqueo viene de imagen, Storage o Firestore.

## Cambios en Firestore Rules

Se fusionaron las reglas protegidas existentes con permisos puntuales para el link externo.

### Campos nuevos permitidos en ficha

En `camposCreacionFicha()` se agregaron:

```txt
origen
linkToken
```

Esto permite distinguir fichas creadas desde la app interna y fichas creadas por link publico.

### Creacion normal de ficha

La creacion normal sigue protegida:

- requiere usuario logueado
- requiere rol activo
- `afiliadorUid` debe coincidir con `request.auth.uid`
- `afiliadorEmail` debe coincidir con el email del documento `usuarios/{uid}`
- no puede incluir `linkToken`
- `origen`, si existe, debe ser `app`
- debe crear correctamente `dniIndex`

### Link publico usado valido

Se agrego una funcion para validar que el link se marque como usado en el mismo batch:

```txt
linkPublicoUsadoValido(token, docId)
```

Valida que:

- `linksCargaPublica/{token}` quede con `usado == true`
- `fichaId` coincida con la ficha creada
- `dni` coincida con la ficha creada
- el link no este vencido
- `afiliadorUid` y `afiliadorEmail` coincidan

### Creacion publica de ficha

Se agrego:

```txt
creacionFichaPublicaValida(docId)
```

Valida que:

- `origen == 'link_publico'`
- exista `linkToken`
- `archivoDniPath` apunte a `dnisPublicos/{token}/...`
- la ficha quede pendiente
- el link quede usado en el mismo batch
- exista el indice `dniIndex` consistente

Importante: se quito la condicion `request.auth == null` porque el link externo puede abrirse desde el mismo navegador donde el afiliador ya tiene sesion activa. La seguridad no depende de estar deslogueado, sino del token valido, no vencido y no usado.

### Coleccion `linksCargaPublica`

Se agrego:

```txt
match /linksCargaPublica/{token}
```

Permisos:

- `get`: publico solo si `usado == false` y `venceEn > request.time`.
- `list`: denegado.
- `create`: solo usuario logueado con rol activo.
- `create`: `afiliadorUid` debe coincidir con `request.auth.uid`.
- `create`: `usado` debe ser `false`.
- `create`: `venceEn` debe ser futuro.
- `update`: solo si cumple `usoLinkPublicoValido(token)`.
- `delete`: denegado.

### Coleccion `dniIndex`

Se mantuvo la proteccion de no listar todo:

- `get`: usuario activo puede consultar un DNI puntual.
- `list`: solo admin/supervisor.
- `create`: usuario activo para carga normal.
- `create`: carga publica si la ficha publica correspondiente existe en el mismo batch.
- `update`: denegado.
- `delete`: mantiene la logica protegida existente.

## Cambios en Storage Rules

Se agrego el path:

```txt
dnisPublicos/{token}/{fileName}
```

Permisos:

- `create`: permitido si:
  - el link existe
  - `usado == false`
  - `venceEn > request.time`
  - archivo menor a 5 MB
  - `contentType == image/jpeg`
- `get`: permitido solo a:
  - admin/supervisor
  - afiliador dueño del link
- `list`: denegado.
- `update/delete`: denegado.

Importante: se quito `request.auth == null` tambien en Storage para que el link externo funcione aunque el navegador tenga una sesion activa.

## Seguridad: que quedo cerrado

- No se puede listar `linksCargaPublica`.
- No se puede listar `dnisPublicos`.
- No se puede listar `dniIndex` como afiliador.
- No se puede editar un link publico libremente.
- No se puede borrar un link publico.
- No se puede crear una ficha publica sin token.
- No se puede crear una ficha publica con `archivoDniPath` fuera de `dnisPublicos/{token}`.
- No se puede usar el link si vencio.
- No se puede usar el link si ya fue marcado como usado.
- La ficha queda asociada al afiliador dueño del link.
- Los archivos publicos del DNI no quedan publicamente legibles.
- Storage limita tipo de archivo a JPG y tamaño menor a 5 MB.

## Seguridad: superficie abierta intencionalmente

Para que una persona externa pueda cargar la ficha, se abrio de forma controlada:

- lectura publica puntual de `linksCargaPublica/{token}` si el token existe, no vencio y no fue usado
- subida publica a `dnisPublicos/{token}` mientras el token este vigente y no usado
- creacion publica de ficha solo si el batch marca el link como usado y crea el indice DNI consistente

Esto no es una apertura general de la base. Es una apertura limitada por token.

## Riesgos residuales a revisar

### 1. Link filtrado

Quien tenga el link puede cargar la ficha mientras no este vencido ni usado.

Mitigacion actual:

- token aleatorio
- vencimiento 24 hs
- un solo uso

Mitigacion posible:

- reducir vencimiento
- agregar captcha
- agregar una pantalla de confirmacion con datos minimos

### 2. Subidas repetidas antes de enviar

Mientras el link no este usado, alguien con el token podria intentar subir varias imagenes JPG a `dnisPublicos/{token}`.

Mitigacion actual:

- maximo 5 MB por archivo
- solo JPG
- path atado a token
- no se puede listar
- no se puede leer publicamente

Mitigacion posible:

- mover el guardado a una API server-side
- marcar un estado intermedio de subida
- limitar por App Check o captcha
- limpieza periodica de archivos huerfanos

### 3. Sin captcha

Por ahora no se implemento captcha.

Motivo:

- el link es aleatorio, unico y vence
- se priorizo mantener el flujo simple

Mitigacion futura recomendada:

- Cloudflare Turnstile o reCAPTCHA antes de permitir guardar

### 4. Datos visibles por token

El `get` publico de `linksCargaPublica/{token}` permite validar el link y obtener datos del afiliador del link.

Mitigacion actual:

- no hay `list`
- solo se puede leer si se conoce el token
- solo si no vencio y no fue usado

Mitigacion posible:

- guardar menos datos visibles en el link
- mover validacion a una API backend

## Despliegue necesario

No alcanza con desplegar la app. Tambien hay que publicar reglas.

Si se usa CLI:

```bash
firebase deploy --only firestore:rules,storage
```

Si se usa Firebase Console:

1. Pegar `firestore.rules` en Firestore Database -> Rules -> Publish.
2. Pegar `storage.rules` en Storage -> Rules -> Publish.
3. Generar un link nuevo.
4. Probar con ese link nuevo.

## Estado de validacion local

Se ejecuto:

```bash
npm.cmd run lint
```

Resultado:

- sin errores
- quedan warnings existentes/no bloqueantes

Tambien se ejecuto build en pruebas previas:

```bash
npm.cmd run build
```

Resultado:

- TypeScript pasa
- la build local corta por `Firebase: Error (auth/invalid-api-key)` del entorno local, problema ya existente de configuracion/env local

