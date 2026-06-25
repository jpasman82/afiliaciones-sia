# CLAUDE.md

Guía para Claude (y otros agentes) que trabajen en este repositorio.

@AGENTS.md
@APP_CONTEXT.md

## Antes de tocar código

1. **Leer `APP_CONTEXT.md`.** Es la referencia técnica vigente del proyecto.
2. **Si vas a modificar código de Next.js**, leer primero `node_modules/next/dist/docs/` (Next 16 tiene breaking changes vs versiones anteriores).
3. **Si la tarea toca seguridad**, leer `docs/seguridad/seguridad-sia.md` para entender los hallazgos abiertos y no abrir vectores nuevos.
4. **Si la tarea es arquitectónica**, leer los ADRs en `docs/decisiones/`.

## Comandos

```bash
npm run dev      # desarrollo local
npm run build    # build de producción (correr siempre antes de pushear cambios grandes)
npm run lint     # ESLint
npm start        # servidor de producción tras el build
```

No hay tests automatizados. La verificación es: `npm run build` + smoke test manual en Vercel preview.

## Convenciones de comunicación con el desarrollador

- **Idioma:** Argentine Spanish con voseo (`vos`, `tenés`, `armás`).
- **Una pregunta por turno.** No fragmentar la conversación con múltiples preguntas simultáneas.
- **Plan antes de código.** Para cambios que toquen más de dos archivos o lógica no trivial, explicar el plan y esperar aprobación antes de escribir código.
- **Sin preámbulos largos.** Ir al punto. Disclaimers cortos.
- **Decir cuando algo es opinión vs hecho.** No presentar opiniones como verdades.

## Convenciones de cambios de código

- **`str_replace` por defecto.** Reemplazo de archivos completos solo si más del 70% cambia.
- **Diffs minimales.** No reformatear código existente que no se está tocando.
- **Surgical edits con file:line.** Cuando se proponga un cambio, indicar archivo y rango de líneas exactos.
- **Sin cambios de UI mezclados con fixes de seguridad.** PRs separados para que el diff sea revisable.
- **Sin renombres masivos.** Los renombres se acuerdan antes, no se hacen "de paso".
- **Conservar idioma del código.** Variables, comentarios y UI en español argentino.

## Convenciones de despliegue

- **Auto-deploy vía Vercel** al mergear a `main`. No hay deploy manual de código.
- **Firestore rules NO se deployan con Vercel.** Hay que correr `firebase deploy --only firestore:rules` manualmente o desde Firebase Console. Un cambio en `firestore.rules` mergeado a `main` no llega a producción solo. **Este es el paso más fácil de olvidar.**
- **Storage rules:** mismo patrón que Firestore rules (`firebase deploy --only storage`).
- **Commits chicos.** Una unidad lógica por commit. El usuario prefiere commits incrementales vía GitHub mobile (1 archivo) o VS Code con agente (multi-archivo).

## Gotchas críticos

Cosas que se aprendieron a las trompadas. **Respetarlas.**

### Firestore

- **`hasOnly()` en rules es all-or-nothing.** Si agregás un campo a un payload sin agregarlo a la lista de `hasOnly()`, **todas las escrituras de esa colección fallan**, incluso las que no usan el campo nuevo. Cambios en payloads requieren actualizar `firestore.rules` en el mismo PR.
- **Las colecciones son implícitas.** Borrar todos los docs de una colección no la elimina; un `addDoc` nuevo la recrea sola.
- **`eliminarFicha` también debe borrar el doc correspondiente en `dniIndex`.** Si no, re-cargar el DNI queda bloqueado por la regla de unicidad.

### Storage

- **No usar `file.makePublic()`** en archivos con datos personales (fotos de DNI, etc.). Las reglas de Storage no aplican a objetos públicos. Usar paths que matcheen reglas (`dnis/{ownerUid}/...`) y leer con SDK.
- **Bajar resolución antes de procesar imágenes de cámara.** La cámara nativa entrega resoluciones que crashean al pasarlas por múltiples canvas. Downscale a ~2200px max antes de cualquier procesamiento.

### Didit

- **Idempotencia del webhook:** solo marcar la sesión como procesada en estados finales (`Approved`, `Declined`). Si se marca antes, webhooks posteriores se descartan y se pierde data.
- **`parsed_address` viene vacío en DNIs argentinos.** Hay que parsear el campo `address` libre (formato `calle número - localidad`) con el helper `parsearAddressLibre()`.
- **Redirect-back de Didit es inestable.** Workaround actual: localStorage + polling (ver `hooks/useDiditSession.ts`). Bug reportado a Didit, sin ETA de fix.

### Next.js 16

- Breaking changes vs Next 15. **Leer `node_modules/next/dist/docs/`** antes de modificar rutas, fetch, server components, o cualquier API de Next.
- App Router únicamente. No hay Pages Router en este proyecto.

## Decisiones arquitectónicas vigentes

Resumen para no re-decidir cosas ya decididas. Detalle en `docs/decisiones/`.

- **Single-tenant por cliente.** Un Firebase y un Vercel por partido. NO multi-tenant. Ver `ADR-001-single-tenant.md`.
- **Branding extraído** (en proceso) a `app/lib/branding.ts` para soportar múltiples clientes sin tocar código.
- **Manual + electrónico conviven.** El flujo manual no se va a deprecar aunque se apruebe la afiliación electrónica, porque hay provincias que no van a adherir.

## Modelo de datos resumido

Para referencia rápida. Detalle completo en `APP_CONTEXT.md`.

- `usuarios/{uid}` — perfil + rol (`pendiente` | `afiliador` | `supervisor` | `admin`).
- `afiliaciones/{id}` — fichas. Campo `origen` discrimina (`manual`, `link_publico`, `contacto_bot`).
- `linksCargaPublica/{token}` — tokens efímeros para flujo público.
- `dniIndex/{dni}` — índice de unicidad de DNI.
- `sesionesDidit/{localId}` — sesiones de verificación con Didit.

## Lo que NO se hace

Anti-patrones explícitos en este proyecto:

- ❌ No agregar `dangerouslySetInnerHTML` en ningún componente.
- ❌ No introducir nuevos `NEXT_PUBLIC_*` con secrets — los `NEXT_PUBLIC_*` viajan al bundle del cliente.
- ❌ No logear PII (UID, email, DNI, nombre completo) en endpoints de servidor. Va a logs de Vercel.
- ❌ No leer source de dependencias en `node_modules/` salvo la documentación de Next bajo `node_modules/next/dist/docs/`.
- ❌ No cambiar el modelo de datos sin actualizar reglas de Firestore en el mismo PR.
- ❌ No reescribir `app/page.tsx` completo en un solo cambio. Es grande pero se modifica con `str_replace`, no con `create_file`.
