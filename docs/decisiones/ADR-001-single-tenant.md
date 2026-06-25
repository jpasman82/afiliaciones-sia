# ADR-001 — Modelo de despliegue: single-tenant por cliente

**Fecha:** 25/06/2026
**Estado:** Decidido
**Decisor:** Juan (dueño del proyecto)

---

## Contexto

La aplicación nació como herramienta interna del partido San Isidro Avanza (SIA) para gestionar el proceso de afiliación manual ante la JEPBA. Durante el desarrollo surgió la posibilidad de que otros partidos provinciales en situación análoga (vecinales, en proceso de constitución, con afiliación manual mientras no se apruebe la afiliación electrónica) usen el mismo software.

Esto plantea una decisión arquitectónica de fondo: **¿cómo se sirve el software a múltiples partidos?**

Las opciones evaluadas fueron tres:

1. **Multi-tenant compartido** — una sola instalación de Firebase + Vercel, con discriminador `organizacionId` en cada documento y reglas de Firestore que aíslan tenants. Modelo SaaS clásico (Slack, Notion).

2. **Single-tenant** — una instancia separada de Firebase + Vercel por cliente, deployada desde el mismo repositorio. Modelo enterprise (software médico, ERPs verticales, sistemas para instituciones).

3. **Monorepo con paquete compartido** — `@sia/core` + variantes. Descartado por overhead injustificado para un equipo de un desarrollador.

## Decisión

**Single-tenant.** Un repositorio fuente único, un proyecto Firebase por cliente, un proyecto Vercel por cliente, despliegues independientes. Todos los proyectos Vercel apuntan al mismo repo y se actualizan automáticamente al mergear en `main`.

## Justificación

Tres razones, en orden de peso:

1. **Cumplimiento legal (Ley 25.326 de Protección de Datos Personales / AAIP).** El partido cliente es responsable del tratamiento de datos personales de sus afiliados. En multi-tenant, el proveedor de la infraestructura comparte responsabilidad de seguridad sobre los datos de terceros que conviven en la misma base. Single-tenant elimina ese problema: cada partido es responsable de su propia instancia, los datos viven en su propio Firebase, no hay aislamiento por software sino por infraestructura.

2. **Modelo comercial consultivo, no masivo.** La venta a partidos políticos es por contrato, no autoservicio. No hay miles de clientes potenciales (decenas, en el mejor escenario). El argumento típico de multi-tenant (reducir costo unitario al escalar) no aplica.

3. **Aislamiento como característica comercial.** El día que un partido pregunte "¿mis datos están separados de los de otros partidos?", la respuesta "tu Firebase es tuyo, nadie más tiene acceso" es más vendible (y más verdadera) que "están en la misma base pero con reglas que los separan".

## Consecuencias

### Positivas

- Aislamiento total de datos entre clientes.
- Cumplimiento AAIP claro: cada partido es responsable de su propia instancia.
- Cada cliente puede tener su dominio personalizado sin overhead de routing.
- Si un cliente quiere divergir del código base (otra provincia, otro circuito JE), se puede gestionar con una branch sin afectar al resto.
- La superficie de un eventual incidente de seguridad queda contenida a una instancia.

### Negativas

- Mantenimiento crece linealmente con número de clientes.
- No hay vista cross-cliente (analytics agregados, búsqueda global de afiliados, etc.).
- No hay efectos de red entre partidos.
- Onboarding de un cliente nuevo es manual: crear Firebase, crear Vercel project, configurar env vars, configurar dominio, capacitar admin. No es autoservicio.
- Reglas de Firestore se despliegan vía CLI por proyecto — fácil de olvidar al hacer un fix de seguridad.

### Mitigaciones a las negativas

- **Mantenimiento escalable:** repo único con todos los Vercel projects conectados. Mergear a `main` rebuiltea todos los proyectos automáticamente.
- **Olvidar deploy de reglas:** configurar Firebase CLI con `.firebaserc` multi-proyecto desde el primer cliente. Documentar el procedimiento de release en un runbook. Considerar GitHub Actions para auto-deployar reglas al mergear cambios en `firestore.rules`.

## Trabajo preparatorio necesario

Estos cambios se hacen ahora aunque haya un solo cliente, para que el segundo (si aparece) sea barato:

1. **Extracción de branding a `app/lib/branding.ts`.** Hoy "SIA", "San Isidro Avanza", el color `#4a148c`, el logo `/public/logo.png` y el dominio de email están dispersos en el código. Centralizar en un módulo de config con defaults = SIA.

2. **Extracción de constantes de scope geográfico/electoral a `app/lib/config.ts`.**
   - `LOCALIDADES` (6 localidades de San Isidro): hoy en `app/lib/estados.ts`.
   - `distrito: 'Buenos Aires'` fijo en formData.
   - Eventualmente, ajustes de máquina de estados de Control si otras provincias tienen procesos distintos a JEPBA.

3. **Configuración de Firebase CLI multi-proyecto.** Aunque hoy haya un solo Firebase, configurar `.firebaserc` y documentar `firebase deploy --only firestore:rules --project sia` para que el patrón esté domado.

4. **Plantilla de variables de entorno por cliente.** Un `.env.example` con todas las variables esperadas, y un runbook que documente qué setear en Vercel para un cliente nuevo.

### Lo que NO se hace

Explícitamente fuera de scope, para no construir abstracciones equivocadas antes de tiempo:

- ❌ Campo `organizacionId` en datos. No hace falta cuando cada cliente tiene su Firebase.
- ❌ Aislamiento de tenants en reglas de Firestore.
- ❌ Flujo de invitación cross-organización.
- ❌ Discriminator en URLs.
- ❌ Auth multi-tenant.

## Triggers para revisitar esta decisión

La decisión se revisa si ocurre alguno de:

- Aparece demanda de **funcionalidad cross-cliente** (búsqueda global, analytics agregados, detección de afiliaciones duplicadas entre partidos). Esto fuerza multi-tenant.
- El número de clientes supera **~20 instalaciones activas**. A esa escala el costo operativo de single-tenant puede empezar a justificar la complejidad de multi-tenant.
- Un cliente exige **costo operativo muy bajo** que no soporta el setup manual de un Firebase nuevo. Apunta a multi-tenant con plan freemium.
- Se decide ofrecer **autoservicio** para que los partidos se onboardéen solos. Apunta a multi-tenant.

Mientras ninguno de esos triggers se cumpla, el modelo single-tenant se mantiene.

## Referencias

- Conversación de decisión: revisión de seguridad SIA, 25/06/2026.
- Lista de seguridad relacionada: `docs/seguridad-sia.md`.
- Documentación AAIP sobre responsabilidad del responsable de tratamiento: https://www.argentina.gob.ar/aaip/datospersonales
