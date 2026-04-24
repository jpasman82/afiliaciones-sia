# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint check
npm start        # production server (after build)
```

No test suite configured.

## Environment Variables

Create a `.env.local` file with:

```
# Firebase (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Email via Gmail SMTP (use an App Password, not the account password)
EMAIL_USER=
EMAIL_PASS=

# Shared secret for /api/notificar endpoint
API_SECRET_TOKEN=
NEXT_PUBLIC_API_SECRET_TOKEN=
```

## Architecture

Single-page React app (`app/page.tsx`, `'use client'`) with Firebase as the full backend. There is no server-side rendering — all data fetching happens client-side via Firestore `onSnapshot` listeners.

**Firebase collections:**
- `usuarios` — user profiles with `rol` field: `pendiente` | `afiliador` | `admin`
- `afiliaciones` — affiliation records; includes all form fields plus `afiliadorNid`, `archivoDni` (Storage URL), `fecha`

**Auth flow (`hooks/useAuth.js`):** Google OAuth only. On first login, creates a `usuarios` doc with `rol: 'pendiente'` and POSTs to `/api/notificar` to email the admin. The UI blocks users with `pendiente` role until an admin approves them.

**Tab navigation:** Five views rendered conditionally inside `app/page.tsx` — `nueva`, `registros`, `usuarios`, `detalle`, `editar`. Tab state is synced with `history.pushState` / `popState` for back-button support.

**DNI upload:** Two modes — camera scanner (captures front+back via `getUserMedia` + canvas, combines into a single PDF with jsPDF) and direct file upload. The resulting file is stored in Firebase Storage under `/dnis/{dni}-{timestamp}.pdf`.

**Permissions:** Admins see all records and the "Usuarios" management tab. Non-admins see only their own records. CSV export operates on the currently visible (filtered) record set.

**API route (`app/api/notificar/route.ts`):** Accepts a Bearer token (`API_SECRET_TOKEN`) and sends an email via Nodemailer/Gmail SMTP. Called only from `useAuth.js` on new user registration.
