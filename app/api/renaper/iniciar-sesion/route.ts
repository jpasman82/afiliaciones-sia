import { NextResponse } from 'next/server';
import { requireRole } from '../../_auth';
import { crearSesionDidit } from '@/app/lib/diditClient';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(request: Request) {
  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) {
    // Diagnóstico temporal: intentar ayudar a identificar por qué falla la autorización
    try {
      // NextResponse may carry a status; mostramos una pista del fallo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (auth.response as any)?.status;
      if (status === 401) console.log('Auth failed: 401 Unauthorized (token inválido o faltante)');
      if (status === 403) {
        console.log('Auth failed: 403 Forbidden (posible Firestore o rol)');
        // Mensajes solicitados para diagnóstico (pueden repetirse según la causa)
        console.log('Usuario no encontrado en Firestore');
        console.log('Rol no autorizado:', undefined);
      }
    } catch (e) {
      console.log('Error al inspeccionar auth.response', e);
    }
    return auth.response;
  }

  // Token validado — mostrar uid para diagnóstico
  console.log('Token validado, uid:', auth.user.uid);
  // UID extraído del token (diagnóstico solicitado)
  const uid = auth.user.uid;
  console.log('UID del token:', uid);
  // Mostrar project id de Firebase Admin (diagnóstico solicitado)
  console.log('Firebase project:', process.env.FIREBASE_ADMIN_PROJECT_ID);

  let afiliadorUid: string;
  let afiliadorNombre: string;
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).afiliadorUid !== 'string' ||
      typeof (body as Record<string, unknown>).afiliadorNombre !== 'string'
    ) {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
    }
    ({ afiliadorUid, afiliadorNombre } = body as { afiliadorUid: string; afiliadorNombre: string });
  } catch {
    console.log('Error al parsear body de la petición');
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  try {
    const vendorData = JSON.stringify({
      afiliadorUid,
      afiliadorNombre,
      timestamp: new Date().toISOString(),
    });

    // {session_id} es el template que Didit sustituye con el ID real antes de redirigir.
    const callback = `${APP_URL}/?tab=nueva&didit_session={session_id}`;

    // Mostrar rol del usuario encontrado para diagnóstico
    console.log('Usuario encontrado, rol:', auth.user.role);

    // Comprobar adminDb si existe (diagnóstico seguro sin romper lógica)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (global as any).adminDb !== 'undefined' && (global as any).adminDb === null) {
        console.log('adminDb es null');
      }
    } catch (e) {
      // no bloquear el flujo por el chequeo diagnóstico
    }

    const sesion = await crearSesionDidit({ vendorData, callback });

    return NextResponse.json({ sessionId: sesion.session_id, url: sesion.url });
  } catch (err) {
    console.error('[renaper/iniciar-sesion] Error al crear sesión Didit:', err);
    return NextResponse.json({ error: 'Error al crear sesión' }, { status: 500 });
  }
}
