import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';
import { crearSesionDidit } from '@/app/lib/diditClient';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(request: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const idToken = authHeader.slice(7);
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const userSnap = await adminDb.collection('usuarios').doc(uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }
  const rol = userSnap.data()?.rol as string | undefined;
  if (!rol || !ROLES_PERMITIDOS.includes(rol)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }

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

    const sesion = await crearSesionDidit({ vendorData, callback });

    return NextResponse.json({ sessionId: sesion.session_id, url: sesion.url });
  } catch (err) {
    console.error('[renaper/iniciar-sesion] Error al crear sesión Didit:', err);
    return NextResponse.json({ error: 'Error al crear sesión' }, { status: 500 });
  }
}
