import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { requireRole } from '../../_auth';
import { crearSesionDidit } from '@/app/lib/diditClient';
import { adminDb } from '@/app/lib/firebaseAdmin';

const ROLES_PERMITIDOS = ['admin', 'supervisor', 'afiliador'];
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(request: Request) {
  const auth = await requireRole(request, ROLES_PERMITIDOS);
  if (!auth.ok) return auth.response;

  const afiliadorUid = auth.user.uid;

  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const usuarioSnap = await adminDb.collection('usuarios').doc(afiliadorUid).get();
  if (!usuarioSnap.exists) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }
  const usuarioData = usuarioSnap.data()!;
  const afiliadorNombre = `${usuarioData.nombre ?? ''} ${usuarioData.apellido ?? ''}`.trim() || 'Sin nombre';

  try {
    // localId es el identificador que viaja en la URL de callback y en vendorData.
    // No podemos usar el session_id de Didit en el callback porque aún no existe
    // cuando construimos la URL. El webhook extrae localId de vendorData y lo
    // persiste en Firestore para que el endpoint /estado pueda encontrar la sesión.
    const localId = randomUUID();
    const vendorData = JSON.stringify({
      afiliadorUid,
      afiliadorNombre,
      localId,
      timestamp: new Date().toISOString(),
    });

    const callback = `${APP_URL}/?tab=nueva&didit_session=${localId}`;
    const sesion = await crearSesionDidit({ vendorData, callback });

    return NextResponse.json({ sessionId: localId, url: sesion.url });
  } catch (err) {
    console.error('[renaper/iniciar-sesion] Error al crear sesión Didit:', err);
    return NextResponse.json({ error: 'Error al crear sesión' }, { status: 500 });
  }
}
