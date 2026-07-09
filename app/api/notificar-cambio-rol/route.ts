import { NextResponse } from 'next/server';
import { requireRole } from '../_auth';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { appUrl, roleLabel, sendMail, userDisplayName } from '@/app/lib/emailNotifications';

export async function POST(request: Request) {
  const auth = await requireRole(request, ['admin', 'supervisor']);
  if (!auth.ok) return auth.response;
  if (!adminDb) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const uid = typeof body.uid === 'string' ? body.uid : '';
  const rolAnterior = typeof body.rolAnterior === 'string' ? body.rolAnterior : '';
  const nuevoRol = typeof body.nuevoRol === 'string' ? body.nuevoRol : '';
  if (!uid || !nuevoRol) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const userSnap = await adminDb.collection('usuarios').doc(uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const usuario = userSnap.data()!;
  if (usuario.rol !== nuevoRol) {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    await sendMail(
      usuario.email ? [usuario.email] : [],
      'SIA AFILIACIONES - Tu usuario cambio de estado',
      `Hola ${userDisplayName(usuario)}.\n\nTu usuario en SIA Afiliaciones cambio de estado${rolAnterior ? ` de ${roleLabel(rolAnterior)}` : ''} a ${roleLabel(nuevoRol)}.\n\nYa podes ingresar a la plataforma para revisar tu acceso.\n${appUrl()}/`
    );
  } catch {
    // El fallo del email no bloquea el cambio de rol.
  }

  return NextResponse.json({ success: true });
}
