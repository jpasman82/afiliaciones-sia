# Afiliaciones SIA

Aplicación web para la gestión y control del proceso de afiliación de partidos políticos provinciales en Argentina. Diseñada en origen para San Isidro Avanza (SIA, distrito San Isidro, Buenos Aires), y construida para ser desplegable como instancia independiente para otros partidos vecinales en situación análoga.

La app cubre el ciclo completo: carga de fichas en campo por afiliadores, captura de DNI (cámara, archivo o verificación con Didit), seguimiento del estado ante la Junta Electoral provincial, y módulos de control administrativo y de gestión de usuarios.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Firebase (Auth, Firestore, Storage) · Tailwind CSS 4 · Vercel.

Integraciones: Didit (verificación de identidad y extracción de datos del DNI), WhatsApp Cloud API (bot de contacto, en proyecto separado), Nodemailer + Hostinger SMTP (notificaciones por email).

## Cómo correr localmente

```bash
npm install
cp .env.example .env.local   # completar variables (ver APP_CONTEXT.md)
npm run dev
```

App disponible en `http://localhost:3000`.

## Despliegue

- **Código:** auto-deploy desde `main` vía Vercel.
- **Reglas de Firestore y Storage:** `firebase deploy --only firestore:rules,storage` (manual, no auto-deploya con Vercel).

## Documentación

- [`CLAUDE.md`](./CLAUDE.md) — convenciones y gotchas para agentes que trabajen en el código.
- [`APP_CONTEXT.md`](./APP_CONTEXT.md) — referencia técnica completa (arquitectura, modelo de datos, flujos, APIs, reglas).
- [`docs/decisiones/`](./docs/decisiones/) — registros de decisiones arquitectónicas (ADRs).
- [`docs/seguridad/`](./docs/seguridad/) — auditoría de seguridad y hallazgos abiertos.

## Modelo de despliegue

La app está pensada como **single-tenant por cliente**: un proyecto Firebase y un proyecto Vercel por partido, todos apuntando al mismo repositorio. Esto aísla los datos personales de cada partido por infraestructura, no por software. Ver [`ADR-001-single-tenant.md`](./docs/decisiones/ADR-001-single-tenant.md).

## Licencia

Privado. Contactar al dueño del repositorio para uso por terceros.
