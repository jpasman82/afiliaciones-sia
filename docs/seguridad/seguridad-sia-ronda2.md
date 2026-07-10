# Plan de remediación de seguridad — Afiliaciones SIA (ronda 2)

> Revisión sobre `afiliaciones-sia-main` al 09/07/2026, posterior al cierre de CRIT-1 / HIGH-1..3 / MED-1..6.
> Consolidado de dos análisis complementarios: uno sobre endpoints + Storage + infra, y otro (Fable) a fondo sobre `firestore.rules`.
> IDs estables (`INT-N` interno, `EXT-N` terceros): usalos para trackear progreso.
> Las severidades son criterio de análisis, no veredicto absoluto.

---

## Leyenda

- 🔴 Alto · 🟠 Medio · 🟢 Bajo / informativo
- Estado: `pendiente` · `en curso` · `resuelto`
- **⚠️ Toca funcionalidad**: requiere decisión conjunta antes de ejecutar (ver sección al final).

---

## Tabla resumen

| ID | Sev | Estado | Toca funcionalidad | Título |
|---|---|---|---|---|
| INT-1 | 🔴 | resuelto ✅ | no | Borrado de archivos ajenos vía `archivoDniPath` manipulable |
| INT-2 | 🟠 | resuelto ✅ | ⚠️ sí | `dniIndex` como oráculo de enumeración de afiliados |
| INT-3 | 🟠 | resuelto ✅ | no | El update de ficha no revalida valores |
| INT-4 | 🟢 | resuelto ✅ | no | Campo legacy `archivoDni` (URL) todavía aceptado |
| EXT-1 | 🟠 | resuelto ✅ | no | Agotamiento de cuota Didit vía link público |
| EXT-2 | 🟠 | resuelto ✅ | no | `dni-preview` expone todo el namespace del afiliador |
| EXT-3 | 🟠 | diferido ⏸️ | no | Sin rate limiting en la superficie pública |
| EXT-4 | 🟠 | resuelto ✅ | no | Confirmar App Check activo en producción |
| EXT-5 | 🟢 | parcial ✅ | no | Webhook de WhatsApp sin dedup ni validación de origen |
| EXT-6 | 🟢 | diferido ⏸️ | no | `guia.html` carga Tailwind desde CDN externo |
| EXT-7 | 🟢 | resuelto ✅ (App Check) | no | Sin límite de cantidad de uploads a `dnisPublicos/{token}/` |

---

## 🔴 INTERNO

### INT-1 — Borrado de archivos ajenos vía `archivoDniPath` manipulable 🔴

**Archivos:** `app/api/afiliaciones/[id]/eliminar/route.ts`, `firestore.rules` (`camposCreacionFicha`, `camposEditablesFichaPendiente`, `creacionFichaValida`, `actualizacionFichaPendienteValida`).

**Problema:** el endpoint de eliminar borra de Storage los paths `archivoDniPath` y `archivoFichaPath` que lee del doc, usando Admin SDK (saltea reglas de Storage). `pathBorrable()` solo valida el prefijo (`dnis/`, `dnisPublicos/`, `fichas/`). Pero el afiliador **controla** `archivoDniPath`: está en los campos de creación y de edición, y ninguna regla valida su formato (ni en create ni en update).

**Impacto:** un afiliador puede editar su ficha pendiente poniendo `archivoDniPath` = `fichas/{OTRA_FICHA_ID}/x.jpg` o `dnis/{OTRO_UID}/x.jpg`, y al eliminar su ficha (pasa el chequeo owner + pendiente) el endpoint borra el archivo apuntado. Destruye DNIs de otros afiliadores o **fichas físicas firmadas** de afiliaciones ya avanzadas. Sabotaje de la evidencia que se presenta a la JEPBA.

> **Coordinación de análisis:** desde las reglas solas, re-apuntar `archivoDniPath` en update parece solo "confusión de datos" (un admin ve el documento equivocado; Storage bloquea la lectura ajena). La gravedad real aparece al sumar el endpoint de eliminar, que borra ese path con Admin SDK. Es el mismo vector visto desde dos lados.

**Fix (no cambia funcionalidad — el afiliador sigue borrando su ficha pendiente):**
1. En el endpoint, no confiar en el path del doc. Validar antes de borrar:
   - `archivoFichaPath` debe matchear exactamente `fichas/{id}/...` (el `id` de la ficha que se borra).
   - `archivoDniPath` debe matchear `dnis/{ficha.afiliadorUid}/...` o `dnisPublicos/...`.
   - Si no matchea, no borrar ese archivo (o abortar), sin fallar en silencio.
2. Defensa en profundidad en `firestore.rules`: validar el patrón `dnis/{auth.uid}/...` (o `dnisPublicos/...`) para `archivoDniPath` **tanto en create como en update** (hoy solo la creación pública lo valida).

---

### INT-2 — `dniIndex` como oráculo de enumeración de afiliados 🟠 ⚠️ Toca funcionalidad

**Archivos:** `firestore.rules` (`match /dniIndex/{dni}` → `allow get`, línea ~229), `app/page.tsx` (chequeo de unicidad previo al guardado, ~línea 1101).

**Problema:** `get` sobre `dniIndex/{dni}` está habilitado para cualquier `rolActivo`. El doc devuelve `{ fichaId, afiliadorUid, dni, fecha }`. `list` ya está bien restringido (admin/supervisor), pero `get` puntual no.

**Impacto:** un afiliador con cuenta válida puede scriptear `get` sobre todo el rango de DNIs (aprox. 20M–47M) y **enumerar qué DNIs están afiliados al partido**, más el `afiliadorUid` y `fichaId` de cada uno. No es solo consulta puntual: sin rate limiting, es enumeración masiva. La afiliación política es dato sensible bajo Ley 25.326 (categoría especial), así que pesa más de lo que aparenta.

**Fix propuesto (⚠️ cambia el flujo de chequeo de unicidad):** hoy el cliente hace `getDoc(dniIndex/{dni})` antes de guardar. Cerrar esto implica mover el chequeo a un endpoint server-side que devuelva solo un booleano (`{ existe: true/false }`), con rate limiting, y cerrar el `get` directo de `dniIndex` a admin/supervisor. Toca el flujo de carga → **analizarlo juntos antes de ejecutar** (ver sección final).

---

### INT-3 — El update de ficha no revalida valores 🟠

**Archivo:** `firestore.rules` (`actualizacionFichaPendienteValida`, líneas 202–208; `fichaCamposValidos`, línea 67).

**Problema:** la creación pasa por `fichaCamposValidos()` (líneas 116 y 153), pero el **update no lo llama**. `actualizacionFichaPendienteValida()` solo chequea propiedad, estado pendiente y `affectedKeys().hasOnly(...)`, sin revalidar contenido. El `dni` está protegido (no figura en `camposEditablesFichaPendiente`), pero el resto queda libre: un dueño puede editar `localidad` a un string arbitrario (fuera de la lista de 6), `nombres`/`apellidos` a 100KB, `mail` inválido, etc. Sumado a que en el create tampoco se validan `calle, numero, piso, dpto, profesion, estadoCivil, clase, fechaNacimiento, lugarNacimiento, nacionalidad, celular`.

**Impacto:** datos sucios que rompen filtros/exportaciones, y abuso de tamaño de doc. Medio.

**Fix (no cambia funcionalidad, con límites generosos):**
1. Llamar a una validación de valores también en el update (reusar `fichaCamposValidos()` sobre el subconjunto editable, o una variante parcial).
2. Extender `fichaCamposValidos()` con `is string` + tope de longitud por campo (ej. 100–150 chars) para los campos hoy sin validar.

---

### INT-4 — Campo legacy `archivoDni` (URL) todavía aceptado en creación interna 🟢

**Archivos:** `firestore.rules` (`camposCreacionFicha`, `camposEditablesFichaPendiente`), lecturas en `app/components/ficha/FichaDetalle.tsx` y `app/page.tsx` (fallback `archivoDniPath || archivoDni`).

**Problema:** `creacionFichaValida()` sigue permitiendo `archivoDni` en el payload. Post-CRIT-1 no debería usarse; hoy un afiliador podría guardar una URL arbitraria ahí.

**Impacto:** bajo. Superficie residual + deuda técnica.

**Fix:** sacar `archivoDni` de los campos permitidos en creación/edición. Antes, confirmar que las lecturas con fallback a `archivoDni` sigan sirviendo para fichas viejas que ya lo tengan (no borrar las lecturas, solo dejar de aceptarlo en escritura nueva).

---

## 🟠 TERCEROS

### EXT-1 — Agotamiento de cuota Didit vía link público 🟠

**Archivo:** `app/api/link-publico/[token]/iniciar-sesion-didit/route.ts`.

**Problema:** con un token de link válido (se comparten por WhatsApp, fáciles de reenviar/filtrar), un tercero puede llamar el endpoint en loop. Cada llamada crea una sesión Didit real y **no marca el link como usado**, así que se repite durante las 24h de vida del link.

**Impacto:** vacía el free tier de Didit (500/mes) o genera costo. DoS económico sobre la verificación de identidad.

**Fix:** cap de sesiones Didit por token (contador en `linksCargaPublica/{token}` o en `sesionesDidit`), más rate limit por IP/token (ver EXT-3).

---

### EXT-2 — `dni-preview` expone todo el namespace del afiliador 🟠

**Archivo:** `app/api/link-publico/[token]/dni-preview/route.ts`.

**Problema:** valida que el path empiece con `dnis/{afiliadorUid}/` o `dnisPublicos/{token}/`, pero **no** que sea el archivo de *esta* carga.

**Impacto:** quien tenga el token puede pedir `path=dnis/{afiliadorUid}/{OTRO_DNI}-didit-{ts}.jpg` y bajar DNIs de otras personas cargadas por Didit por el mismo afiliador. Requiere adivinar DNI + timestamp, pero el timestamp es enumerable en ms y el DNI puede ser conocido. Rompe el scope "un link = un DNI".

**Fix:** scopear el path permitido al `archivoDniPath` de la ficha/sesión asociada a ese token (no al prefijo del afiliador). Para el flujo Didit, resolver el path desde `sesionesDidit` cuyo `vendorData.linkToken == token`.

---

### EXT-3 — Sin rate limiting en la superficie pública 🟠

**Archivos:** todos los endpoints sin auth: `link-publico/[token]` (GET), `iniciar-sesion-didit`, `estado-didit`, `dni-preview`, `whatsapp/webhook`. También el SDK de Firebase directo (relevante para el oráculo de INT-2).

**Problema:** nada throttlea. Cada request dispara varios `get()` en reglas/endpoints.

**Impacto:** un tercero puede inflar los reads de Firestore (factura), floodear el bot de WhatsApp, martillar Didit (EXT-1), o correr el oráculo de enumeración de INT-2 a alta velocidad. Objetivo realista en una app política.

**Fix:** Cloudflare adelante, o Vercel Edge Middleware con límite por IP. Priorizar los endpoints públicos y los que gatillan costo (Didit, email, WhatsApp).

---

### EXT-4 — Confirmar App Check activo en producción 🟠

**Archivo:** `firebaseConfig.js` (línea 18).

**Problema:** App Check solo se inicializa si `NEXT_PUBLIC_APPCHECK_SITE_KEY` está seteado. Si no está en Vercel, las reglas quedan como única defensa contra el uso del SDK fuera del browser legítimo (scripts, bots) — incluido el oráculo de INT-2.

**Impacto:** las reglas son sólidas, pero App Check es lo que frena el abuso automatizado del SDK.

**Fix:** verificar que `NEXT_PUBLIC_APPCHECK_SITE_KEY` esté en Vercel producción y que App Check esté enforced en la consola de Firebase (Firestore + Storage). Es verificación de config, no código.

---

### EXT-5 — Webhook de WhatsApp sin dedup ni validación de origen 🟢

**Archivo:** `app/api/whatsapp/webhook/route.ts`.

**Problema:** el POST no deduplica por `message.id` (Meta reintenta ante timeout → `sendMenu` duplicado), no valida que `entry.id` sea tu WABA, y `verify_token` no se compara con `timingSafeEqual`.

**Impacto:** bajo. Mensajes salientes duplicados (costo/flood). Flujo nuevo, conviene endurecerlo antes de producción.

**Fix:** dedup por `message.id`, validar `entry.id` contra tu WABA, y `verify_token` con comparación constant-time.

---

### EXT-6 — `guia.html` carga Tailwind desde CDN externo 🟢

**Archivo:** `public/guia.html`.

**Problema:** incluye `<script src="https://cdn.tailwindcss.com">` y fuentes de Google. Si el CDN se compromete, corre JS en tu dominio.

**Impacto:** informativo.

**Fix:** self-hostear el CSS/fuentes en `public/`.

---

### EXT-7 — Sin límite de cantidad de uploads a `dnisPublicos/{token}/` 🟢

**Archivo:** `storage.rules` (`match /dnisPublicos/{token}/{fileName}`).

**Problema:** el `create` está bien gated (link válido, <5MB, solo JPEG), pero `{fileName}` es libre y no hay tope de cantidad. Mientras el link esté activo (24h), un tercero con el token puede subir JPEGs de 5MB ilimitados bajo ese prefijo.

**Impacto:** sin exposición de datos, pero abuso de costos de Storage.

**Fix:** validar un nombre de archivo fijo/derivado por token (un solo objeto por carga), o Cloud Function de limpieza. Combina bien con el rate limiting de EXT-3.

---

## ✅ Verificado y correcto (no requiere acción)

Confirmado de forma independiente por los dos análisis:

- Aislamiento de lectura: un afiliador **no** puede listar fichas ajenas ni la colección `usuarios`; las reglas de `list` lo rechazan aunque el cliente fuerce la query.
- Sin escalación de rol: `usuarioInicialValido` fuerza `pendiente` en el create; `actualizacionPerfilPropioValida` hace `rol`/`email` inmutables; supervisor no toca admins/supervisores.
- `afiliaciones` update/delete: propiedad conservada (`conservaPropiedadFicha`), estado no auto-avanzable (`conservaEstadoPendiente`), borrado acotado a pendiente para dueño/supervisor.
- `dniIndex`: `update: if false`, delete atómico con la ficha (`!existsAfter`).
- `linksCargaPublica`: consumo/revocación atómicos, `list: if false`, token de 128 bits.
- Create público encadenado atómicamente (ficha + índice + quema del link) con `getAfter`/`existsAfter`.
- `sesionesDidit` sin bloque `match` → deny-by-default correcto (acceso solo vía Admin SDK). **Sugerencia:** dejar un comentario explícito en `firestore.rules` para que nadie lo "arregle" agregando reglas laxas.
- Sin secrets con prefijo `NEXT_PUBLIC`; `.env*` en `.gitignore`; sin `dangerouslySetInnerHTML`/`eval`; webhooks con HMAC + `timingSafeEqual`; Didit con timestamp anti-replay.

---

## ⚠️ Cambios que requieren decisión conjunta antes de ejecutar

Registrados para analizarlos juntos, no para ejecutarlos de una:

1. **INT-2 — Mover el chequeo de unicidad de DNI a server-side.** Hoy el cliente lee `dniIndex` directo antes de guardar. Cerrar el oráculo implica un endpoint que devuelva solo booleano y restringir el `get` directo. Cambia el flujo de carga (una llamada extra, manejo de error distinto). A decidir: ¿ahora o se difiere?

2. **Permisos de edición/borrado de afiliadores (NO es un hallazgo — es política de producto).** Hoy un afiliador puede editar y eliminar sus propias fichas mientras estén en `pendiente` (antes de escanearse). El fix de INT-1 **conserva** esta capacidad; solo evita que toque archivos ajenos. Si en algún momento querés endurecerlo (ej. que el afiliador no pueda borrar, solo pedir baja), es una decisión de producto separada que analizamos aparte. No se toca sin acordarlo.

---

## 🔎 Punto operativo a confirmar (no es de código)

`scripts/sanear-crit-1.js`: el doc `seguridad-sia.md` lo marca **ejecutado y validado el 26/06/2026** (47 blobs, `withTokens: 0`, `publicAcl: 0`). Registros previos de trabajo sugerían que había quedado **pendiente** al cerrar una sesión durante el setup de Vercel CLI. Como las reglas no aplican a objetos ya marcados públicos, conviene confirmar contra producción que el saneamiento efectivamente corrió antes de dar CRIT-1 por cerrado. Si no corrió, los blobs históricos del webhook de Didit pueden seguir públicos aunque estas reglas estén perfectas.

---

## Plan de remediación por etapas

Cada etapa es un PR independiente, ejecutable sin contexto de la anterior. Recordá: **las reglas de Firestore y Storage no se deployan con Vercel** — hay que correr `firebase deploy --only firestore:rules,storage` a mano.

### Etapa 1 — Prioridad alta (1 PR)
- **INT-1**: validar paths en el endpoint de eliminar + patrón de `archivoDniPath` en reglas (create y update). (No cambia funcionalidad.)
- **EXT-4**: confirmar App Check en Vercel/Firebase. (Solo verificación.)
- Confirmar el punto operativo del script CRIT-1.

### Etapa 2 — Endurecer reglas (1 PR, solo `firestore.rules`)
- **INT-3**: revalidar valores en el update + extender `fichaCamposValidos`.
- **INT-4**: sacar `archivoDni` legacy de escritura.

### Etapa 3 — Reducir superficie de terceros (1 PR)
- **EXT-2**: scopear `dni-preview` al archivo de la carga.
- **EXT-1**: cap de sesiones Didit por link.
- **EXT-7**: límite de uploads a `dnisPublicos/{token}`.

### Etapa 4 — Rate limiting (infra, puede ir en paralelo)
- **EXT-3**: middleware / Cloudflare con límite por IP.

### Etapa 5 — Hardening menor (1 PR)
- **EXT-5**: dedup + validación en webhook WhatsApp.
- **EXT-6**: self-hostear assets de `guia.html`.
- Comentario explícito de deny-by-default en `sesionesDidit`.

### Etapa 6 — Requiere decisión previa
- **INT-2**: chequeo de unicidad server-side (analizar juntos antes).

---

## Estado de cierre (ronda 2)

**9 de 11 hallazgos resueltos. Todos los 🔴 y 🟠 de peso, cerrados o mitigados.**

### Resueltos
- **INT-1** — Endpoint de eliminar valida los paths contra el owner/id de la ficha; reglas validan el patrón de `archivoDniPath` en create y update.
- **INT-2** — El chequeo de unicidad pasa por `/api/dni/existe` (devuelve solo booleano, sin `afiliadorUid`/`fichaId`); el `get` directo de `dniIndex` quedó restringido a admin/supervisor.
- **INT-3** — El update revalida valores vía `fichaCamposValidosParcial` (tolerante a datos legacy); `fichaCamposValidos` extendida con topes de longitud.
- **INT-4** — `archivoDni` legacy fuera de los campos de escritura.
- **EXT-1** — Cap de 10 sesiones Didit por link.
- **EXT-2** — `dni-preview` scopeado a los paths de la sesión Didit del token.
- **EXT-4** — App Check en **Aplicada** para Firestore y Storage (100% verificadas, 0% no verificadas al momento de aplicar).
- **EXT-7** — Cubierto por App Check enforced en Storage (bloquea uploads automatizados fuera del browser).
- **EXT-5 (parcial)** — Dedup por `message.id` en el webhook de WhatsApp.

### Diferidos (con justificación)
- **EXT-3 — Rate limiting.** Aceptado con mitigaciones actuales. El vector que lo ponía en 🟠 (abuso automatizado del SDK) quedó tapado por App Check enforced. Los endpoints públicos tienen mitigaciones propias (cap Didit, `dni-preview` scopeado, HMAC en webhooks, unicidad booleana). Un rate limit formal necesita infra con estado (Vercel KV / Upstash); sumar cuando el volumen lo justifique.
- **EXT-6 — Tailwind CDN en `guia.html`.** 🟢 informativo. El fix prolijo (compilar y self-hostear el CSS) es un mini-build para un riesgo bajo en una página estática. Diferido.
- **EXT-5 (resto)** — Validación de origen del WABA y constant-time del verify token, para cuando se reescriba el webhook al armar el bot de WhatsApp en serio.

### Notas operativas pendientes
- Cuando se arme el bot, ponerle **TTL** a la colección `whatsappMensajesProcesados` (auto-borrado ~7 días) para que no acumule.
- Confirmar contra producción que `scripts/sanear-crit-1.js` (CRIT-1, ronda 1) efectivamente corrió, cuando sea oportuno.
